import Snoowrap from "snoowrap";
import isValidPath from "is-valid-path";
import { config } from "dotenv";
import UberduckTTS, { Voice } from "./UberduckTTS";
import { lstat, mkdir, readFile, readdir, rm, unlink, writeFile } from "fs/promises";
import Screenshotter from "./Screenshotter";
import { useSnoowrapRequester } from "./utils/useSnoowrapRequester";
import { existsSync, fstatSync } from "fs";
import { join } from "path";
import { usePostTitle } from "./utils/usePostTitle";
import Ffmpeg, { FilterSpecification } from "fluent-ffmpeg";
import useFfmpegLogging from "./utils/useFfmpegLogging";
import { useVideoDuration } from "./utils/useVideoDuration";
import { useFfmpegPromise } from "./utils/useFfmpegPromise";
import { useBufferToStream } from "./utils/useBufferToStream";
import { Writable } from "stream";
import { useVideoDimensions } from "./utils/useVideoDimensions";
import RemoveMarkdown from "remove-markdown";
import TwitchTTS from "./TwitchTTS";
import TTS from "./TTS";

// Load environment variables
config();

export interface Comment {
  id: string;
  url: string;
  body: string;
  ups: number;
  audio?: Buffer;
  screenshot?: Buffer;

  topReply?: Omit<Comment, "topReply"> & { isUsed?: boolean };
}

export interface VideoDimensions {
  width: number;
  height: number;
}

export default class Shitposter {
  protected postId: string;
  protected backgroundVideoPath: string;
  protected maxDuration: number;
  protected maxCommentCount: number;
  protected topReplyShowThreshold: number;
  protected videoDimensions: VideoDimensions;

  protected tts: TTS = new TwitchTTS();

  protected screenshotter = new Screenshotter();

  protected TEMP_DIR = "./tmp";
  protected TEMP_IMAGE_PATH = `${this.TEMP_DIR}/temp.jpeg`;
  protected TEMP_AUDIO_PATH = `${this.TEMP_DIR}/temp.wav`;
  protected TEMP_VIDEO_PATH_1 = `${this.TEMP_DIR}/temp1.mp4`;
  protected TEMP_VIDEO_PATH_2 = `${this.TEMP_DIR}/temp2.mp4`;
  protected TEMP_VIDEO_PATH_3 = `${this.TEMP_DIR}/temp3.mp4`;

  protected COMMENT_DELAY = 0;
  protected FPS = 30;

  protected REDDIT_POST_URL_REGEX =
    /^https:\/\/www\.reddit\.com\/r\/[a-zA-Z0-9]+\/comments\/[a-zA-Z0-9]+\/[a-zA-Z0-9_]+\/?$/;
  protected REDDIT_POST_ID_REGEX = /^[a-zA-Z0-9]+$/;

  constructor(
    postUrlOrId: string,
    backgroundVideoPath: string,
    maxDuration = 60,
    maxCommentCount = 10,
    topReplyShowThreshold = 0.8,
    videoDimensions: VideoDimensions = { width: 1080, height: 1920 }
  ) {
    this.setPostId(postUrlOrId);
    this.setBackgroundVideoPath(backgroundVideoPath);
    this.setMaxDuration(maxDuration);
    this.setMaxCommentCount(maxCommentCount);
    this.setTopReplyShowThreshold(topReplyShowThreshold);
    this.setVideoDimensions(videoDimensions);
  }

  async createShitpost() {
    const startTime = new Date();
    console.log(`CREATING SHITPOST FOR POST ${this.postId} STARTED AT [${startTime.toUTCString()}]`);

    // SETUP DIRS
    await this.setupDirectory(this.TEMP_DIR);

    // DOWNLOAD ASSETS
    await this.tts.init();
    await this.screenshotter.init();

    // let postAudio = await readFile(`./output/${this.postId}.wav`);
    // let postScreenshot = await readFile(`./output/${this.postId}.jpeg`);
    const postAudio = await this.getTTS(await usePostTitle(this.postId));
    let postScreenshot = await this.screenshotter.screenshotPost(this.postId);
    // await writeFile(`./output/${this.postId}.wav`, postAudio);
    // await writeFile(`./output/${this.postId}.jpeg`, postScreenshot);

    const comments = await this.getPostComments();
    console.log(comments);
    await this.createCommentAudios(comments);
    await this.createCommentScreenshots(comments);

    await this.tts.close();
    await this.screenshotter.close();

    // CREATE VIDEO

    // resize screenshots
    postScreenshot = await this.resizeScreenshot(postScreenshot);
    // await writeFile(`./output/${this.postId}-resized.jpeg`, postScreenshot);
    await this.resizeCommentScreenshots(comments);

    // overlay audio and screenshots
    const postVideo = await this.overlayScreenshotAndAudio(postScreenshot, postAudio, this.TEMP_VIDEO_PATH_1);
    const commentVideos = await this.createCommentVideos(comments);
    const allVideos = [postVideo, ...commentVideos];

    // trim videos to fit max duration
    let videoDuration = await this.calculateVideoDuration(allVideos);
    while (videoDuration > this.maxDuration) {
      allVideos.pop();
      videoDuration = await this.calculateVideoDuration(allVideos);
    }

    // create background video
    const backgroundVideoFilename = await this.chooseBackgroundVideo();
    const backgroundVideo = await this.formatBackgroundVideo(backgroundVideoFilename, videoDuration);
    // await writeFile(`./output/${this.postId}-background-video.mp4`, backgroundVideo);
    // const backgroundVideo = await readFile(`./output/${this.postId}-background-video.mp4`);

    // overlay videos onto background video
    const video = await this.overlayVideos(backgroundVideo, allVideos);
    await writeFile(this.getOutputPath(), video);

    // CLEANUP TEMP DIR
    await this.cleanupDirectory(this.TEMP_DIR);

    const endTime = new Date();
    console.log(
      `CREATING SHITPOST FOR POST ${this.postId} FINISHED AT [${endTime.toUTCString()}] (took ${
        (endTime.getTime() - startTime.getTime()) / 1000
      }s)`
    );
  }

  protected async calculateVideoDuration(videos: Buffer[]) {
    let duration = 0;

    for (const video of videos) {
      await writeFile(this.TEMP_VIDEO_PATH_1, video);
      duration += (await useVideoDuration(this.TEMP_VIDEO_PATH_1)) + this.COMMENT_DELAY;
    }

    return duration;
  }

  protected async createCommentVideos(comments: Comment[]) {
    const videos: Buffer[] = [];

    for (const comment of comments) {
      const video = await this.overlayScreenshotAndAudio(
        comment.screenshot,
        comment.audio,
        this.TEMP_VIDEO_PATH_1
      );

      videos.push(video);

      if (comment.topReply?.isUsed) {
        const video = await this.overlayScreenshotAndAudio(
          comment.topReply.screenshot,
          comment.topReply.audio,
          this.TEMP_VIDEO_PATH_1
        );

        videos.push(video);
      }
    }

    return videos;
  }

  protected async overlayVideos(backgroundVideo: Buffer, videos: Buffer[]) {
    await writeFile(this.TEMP_VIDEO_PATH_1, backgroundVideo);
    const command = useFfmpegLogging(Ffmpeg(this.TEMP_VIDEO_PATH_1));

    // add inputs and filters for each video
    let currentTime = 0;
    const filter: FilterSpecification[] = [];
    const audioOutputs: string[] = [];

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];

      // add input
      const videoPath = `${this.TEMP_DIR}/video-${i}.mp4`;
      await writeFile(videoPath, video);

      command.input(videoPath);

      // currentTime = Number(currentTime.toFixed(2));

      // create filter
      const duration = Number((await useVideoDuration(videoPath)).toFixed(2));
      const dimensions = await useVideoDimensions(videoPath);

      const inputMain = i === 0 ? "[0:v]" : `[v${i}]`;
      const inputOverlay = `[${i + 1}:v]`;

      const inputOverlayAudio = `[${i + 1}:a]`;

      const output = i === videos.length - 1 ? "[vout]" : `[v${i + 1}]`;
      const outputAudio = `[a${i + 1}]`;

      audioOutputs.push(outputAudio);

      filter.push({
        filter: "overlay",
        options: {
          x: 0,
          y: (this.videoDimensions.height - dimensions.height) / 2,
          enable: `between(t,${currentTime},${currentTime + duration})`,
        },
        inputs: [inputMain, inputOverlay],
        outputs: output,
      });
      filter.push({
        filter: "adelay",
        options: `${currentTime}s:all=1`,
        inputs: inputOverlayAudio,
        outputs: outputAudio,
      });

      currentTime += duration + this.COMMENT_DELAY;
    }

    filter.push({
      filter: "concat",
      options: {
        n: videos.length,
        v: 0,
        a: 1,
        // duration: `${videoDuration}s`,
      },
      inputs: audioOutputs,
      outputs: "[aout]",
    });

    command.map("[vout]");
    command.map("[aout]");
    command.outputOptions("-async 1");
    command.complexFilter(filter).FPS(this.FPS).format("mp4").save(this.TEMP_VIDEO_PATH_2);

    return useFfmpegPromise(command);
  }

  protected async overlayScreenshotAndAudio(screenshot: Buffer, audio: Buffer, outputPath: string) {
    await writeFile(this.TEMP_IMAGE_PATH, screenshot); // write screenshot to temp file since ffmpeg only supports one input stream

    const command = useFfmpegLogging(Ffmpeg(this.TEMP_IMAGE_PATH))
      .input(useBufferToStream(audio))
      .outputFPS(this.FPS)
      .outputFormat("mp4")
      .save(outputPath);

    return useFfmpegPromise(command);
  }

  protected async resizeCommentScreenshots(comments: Comment[]) {
    for (const comment of comments) {
      comment.screenshot = await this.resizeScreenshot(comment.screenshot);
      // await writeFile(`./output/${comment.id}-resized.jpeg`, comment.screenshot);

      if (comment.topReply?.isUsed) {
        comment.topReply.screenshot = await this.resizeScreenshot(comment.topReply.screenshot);
        // await writeFile(`./output/${comment.topReply.id}-resized.jpeg`, comment.topReply.screenshot);
      }
    }
  }

  protected resizeScreenshot(screenshot: Buffer) {
    const command = useFfmpegLogging(Ffmpeg(useBufferToStream(screenshot)))
      .size(`${this.videoDimensions.width}x?`)
      .frames(1)
      .save(this.TEMP_IMAGE_PATH);

    return useFfmpegPromise(command);
  }

  protected async formatBackgroundVideo(backgroundVideoFilename: string, videoDuration: number) {
    const duration = await useVideoDuration(backgroundVideoFilename);

    // choose random start time with a {videoDuration} second buffer from the end
    const startTime = Math.floor(Math.random() * (duration - (videoDuration + 1)));

    const cutResizeBackgroundVideo = useFfmpegLogging(Ffmpeg(backgroundVideoFilename))
      .fps(this.FPS)
      .setStartTime(startTime)
      .setDuration(videoDuration)
      .size(`?x${this.videoDimensions.height}`)
      .save(this.TEMP_VIDEO_PATH_1);
    await useFfmpegPromise(cutResizeBackgroundVideo);
    // return backgroundVideoCutResized;

    const cropBackgroundVideo = useFfmpegLogging(Ffmpeg(this.TEMP_VIDEO_PATH_1))
      .videoFilter(
        `crop=${this.videoDimensions.width}:${this.videoDimensions.height}:(in_w-${this.videoDimensions.width})/2:0`
      )
      .save(this.TEMP_VIDEO_PATH_2);
    const backgroundVideoCutResizedCropped = await useFfmpegPromise(cropBackgroundVideo);

    return backgroundVideoCutResizedCropped;
  }

  protected async chooseBackgroundVideo() {
    // if background video path is a directory, choose a random file from it
    if ((await lstat(this.backgroundVideoPath)).isDirectory()) {
      const files = await readdir(this.backgroundVideoPath);
      const file = files[Math.floor(Math.random() * files.length)];

      return join(this.backgroundVideoPath, file);
    } else {
      return this.backgroundVideoPath;
    }
  }

  protected async createCommentAudios(comments: Comment[]) {
    // for (const comment of comments) {
    //   comment.audio = await readFile(`./output/${comment.id}.wav`);
    // }
    // return;

    for (let i = 0; i < comments.length; i++) {
      const comment = comments[i];
      console.log(`Creating audio for comment ${i + 1} of ${comments.length}`);

      comment.audio = await this.getTTS(comment.body);
      // await writeFile(`./output/${comment.id}.wav`, comment.audio);

      console.log(`Created audio for comment ${i + 1} of ${comments.length}`);

      // if top reply enough percentage of upvotes of the comment, create audio for it since it will be shown in the video
      if (comment.topReply?.isUsed) {
        console.log(`Creating audio for top reply of comment ${i + 1}`);

        comment.topReply.audio = await this.getTTS(comment.topReply.body);
        // await writeFile(`./output/${comment.topReply.id}.wav`, comment.topReply.audio);

        console.log(`Created audio for top reply of comment ${i + 1}`);
      }
    }
  }

  protected async createCommentScreenshots(comments: Comment[]) {
    // for (const comment of comments) {
    //   comment.screenshot = await readFile(`./output/${comment.id}.jpeg`);
    // }
    // return;

    for (let i = 0; i < comments.length; i++) {
      const comment = comments[i];
      console.log(`Creating screenshot for comment ${i + 1} of ${comments.length}`);

      comment.screenshot = await this.screenshotter.screenshotComment(comment);
      // await writeFile(`./output/${comment.id}.jpeg`, comment.screenshot);

      console.log(`Created screenshot for comment ${i + 1} of ${comments.length}`);

      // if top reply enough percentage of upvotes of the comment, create screenshot for it since it will be shown in the video
      if (comment.topReply?.isUsed) {
        console.log(`Creating screenshot for top reply of comment ${i + 1}`);

        comment.topReply.screenshot = await this.screenshotter.screenshotComment(comment.topReply);
        // await writeFile(`./output/${comment.topReply.id}.jpeg`, comment.topReply.screenshot);

        console.log(`Created screenshot for top reply of comment ${i + 1}`);
      }
    }
  }

  protected async getTTS(text: string, voice = "Joey") {
    return this.tts.speak(text, voice);
  }

  protected async getPostComments() {
    const r = useSnoowrapRequester();

    let post = r.getSubmission(this.postId);

    await new Promise<void>((resolve) => {
      post.expandReplies({ limit: 5, depth: 1 }).then((p) => {
        post = p;
        resolve();
      });
    });

    // sort by top
    post.comments.sort((a, b) => b.ups - a.ups);

    const comments = post.comments
      .filter((c) => c.body !== "[removed]" && c.body !== "[deleted]") // remove removed comments
      .slice(0, this.maxCommentCount)
      .map((comment) => {
        comment.replies.sort((a, b) => b.ups - a.ups);

        return <Comment>{
          id: comment.id,
          url: `https://www.reddit.com${comment.permalink}`,
          body: RemoveMarkdown(comment.body),
          ups: comment.ups,

          topReply: comment.replies[0]
            ? {
                id: comment.replies[0].id,
                url: `https://www.reddit.com${comment.replies[0].permalink}`,
                body: RemoveMarkdown(comment.replies[0].body),
                ups: comment.replies[0].ups,
                isUsed: comment.replies[0].ups > comment.ups * this.topReplyShowThreshold,
              }
            : undefined,
        };
      });

    return comments;
  }

  protected async setupDirectory(dir: string) {
    if (existsSync(dir)) {
      await rm(dir, { recursive: true, force: true });
    }

    await mkdir(dir);
  }

  protected async cleanupDirectory(dir: string) {
    await rm(dir, { recursive: true, force: true });
  }

  // GETTERS AND SETTERS
  getOutputPath() {
    return `./${this.postId}.mp4`;
  }

  setPostId(postUrlOrId: string) {
    const isUrl = new Promise(() => new URL(postUrlOrId)).catch(() => false).then(() => true);
    let postId = "";

    if (isUrl) {
      const postUrl = new URL(postUrlOrId);
      if (!this.REDDIT_POST_URL_REGEX.test(postUrl.href)) {
        throw new Error("Invalid Reddit post URL");
      }

      // extract post id from url
      const path = postUrl.pathname.split("/");
      postId = path[4];
    } else {
      postId = postUrlOrId;
    }

    if (!this.REDDIT_POST_ID_REGEX.test(postId)) {
      throw new Error("Invalid Reddit post ID");
    }

    this.postId = postId;
  }

  setBackgroundVideoPath(backgroundVideoPath: string) {
    if (!isValidPath(backgroundVideoPath)) {
      throw new Error("Invalid path");
    }

    this.backgroundVideoPath = backgroundVideoPath;
  }

  setMaxDuration(maxDuration: number) {
    if (maxDuration < 1) {
      throw new Error("Max duration must be greater than 0");
    }

    this.maxDuration = maxDuration;
  }

  setMaxCommentCount(commentCount: number) {
    if (commentCount < 1) {
      throw new Error("Comment count must be greater than 0");
    } else if (commentCount > 30) {
      throw new Error("Comment count must be less than or equal to 30");
    }

    this.maxCommentCount = commentCount;
  }

  setTopReplyShowThreshold(topReplyShowThreshold: number) {
    if (topReplyShowThreshold < 0 || topReplyShowThreshold > 1) {
      throw new Error("Top reply show threshold must be between 0 and 1");
    }

    this.topReplyShowThreshold = topReplyShowThreshold;
  }

  setVideoDimensions(videoDimensions: VideoDimensions) {
    if (videoDimensions.width < 1 || videoDimensions.height < 1) {
      throw new Error("Video dimensions must be greater than 0");
    }

    this.videoDimensions = videoDimensions;
  }
}
