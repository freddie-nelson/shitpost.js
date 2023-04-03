import Snoowrap from "snoowrap";
import isValidPath from "is-valid-path";
import { config } from "dotenv";
import TTS, { Voice } from "./TTS";
import { writeFile } from "fs/promises";
import Screenshotter from "./Screenshotter";
import { useSnoowrapRequester } from "./utils/useSnoowrapRequester";

// Load environment variables
config();

const REDDIT_POST_URL_REGEX =
  /^https:\/\/www\.reddit\.com\/r\/[a-zA-Z0-9]+\/comments\/[a-zA-Z0-9]+\/[a-zA-Z0-9_]+\/?$/;
const REDDIT_POST_ID_REGEX = /^[a-zA-Z0-9]+$/;

export interface Comment {
  id: string;
  url: string;
  body: string;
  ups: number;
  audio?: Buffer;
  screenshot?: Buffer;

  topReply: Omit<Comment, "topReply">;
}

export interface VideoDiemensions {
  width: number;
  height: number;
}

export default class Shitposter {
  protected postId: string;
  protected backgroundVideoPath: string;
  protected commentCount: number;
  protected topReplyShowThreshold: number;
  protected narratorVoice: Voice | (() => Voice);
  protected videoDimensions: VideoDiemensions;

  protected tts = new TTS();
  protected screenshotter = new Screenshotter();

  constructor(
    postUrlOrId: string,
    backgroundVideoPath: string,
    commentCount = 10,
    topReplyShowThreshold = 0.8,
    narratorVoice: Voice | (() => Voice) = () =>
      this.tts.voices[Math.floor(Math.random() * this.tts.voices.length)],
    videoDimensions: VideoDiemensions = { width: 1080, height: 1920 }
  ) {
    this.setPostId(postUrlOrId);
    this.setBackgroundVideoPath(backgroundVideoPath);
    this.setCommentCount(commentCount);
    this.setTopReplyShowThreshold(topReplyShowThreshold);
    this.narratorVoice = narratorVoice;
    this.setVideoDimensions(videoDimensions);
  }

  async createShitpost() {
    // await this.tts.init();
    await this.screenshotter.init();

    const postScreenshot = await this.screenshotter.screenshotPost(this.postId);
    await writeFile(`./output/${this.postId}.jpeg`, postScreenshot);

    // const comments = await this.getPostComments();
    // await this.createCommentAudios(comments);
    // await this.createCommentScreenshots(comments);
    // console.log(comments);

    // await this.tts.close();
    await this.screenshotter.close();
  }

  protected async createCommentAudios(comments: Comment[]) {
    for (let i = 0; i < comments.length; i++) {
      const comment = comments[i];
      console.log(`Creating audio for comment ${i + 1} of ${comments.length}`);

      comment.audio = await this.getTTS(comment.body);
      await writeFile(`./${comment.id}.wav`, comment.audio);

      console.log(`Created audio for comment ${i + 1} of ${comments.length}`);

      // if top reply enough percentage of upvotes of the comment, create audio for it since it will be shown in the video
      if (comment.topReply.ups > comment.ups * this.topReplyShowThreshold) {
        console.log(`Creating audio for top reply of comment ${i + 1}`);

        comment.topReply.audio = await this.getTTS(comment.topReply.body);
        await writeFile(`./output/${comment.topReply.id}.wav`, comment.topReply.audio);

        console.log(`Created audio for top reply of comment ${i + 1}`);
      }
    }
  }

  protected async createCommentScreenshots(comments: Comment[]) {
    for (let i = 0; i < comments.length; i++) {
      const comment = comments[i];
      console.log(`Creating screenshot for comment ${i + 1} of ${comments.length}`);

      comment.screenshot = await this.screenshotter.screenshotComment(comment);
      await writeFile(`./output/${comment.id}.jpeg`, comment.screenshot);

      console.log(`Created screenshot for comment ${i + 1} of ${comments.length}`);

      // if top reply enough percentage of upvotes of the comment, create screenshot for it since it will be shown in the video
      if (comment.topReply.ups > comment.ups * this.topReplyShowThreshold) {
        console.log(`Creating screenshot for top reply of comment ${i + 1}`);

        comment.topReply.screenshot = await this.screenshotter.screenshotComment(comment.topReply);
        await writeFile(`./output/${comment.topReply.id}.jpeg`, comment.topReply.screenshot);

        console.log(`Created screenshot for top reply of comment ${i + 1}`);
      }
    }
  }

  protected async getTTS(text: string, voice = this.narratorVoice) {
    if (!this.tts.getIsInitialised()) await this.tts.init();

    return this.tts.speak(text, typeof voice === "string" ? voice : voice());
  }

  protected async getPostComments() {
    const r = useSnoowrapRequester();

    const post = r.getSubmission(this.postId);

    // sort by top
    post.comments.sort((a, b) => b.ups - a.ups);

    const comments = post.comments
      .filter((c) => c.body !== "[removed]" && c.body !== "[deleted]") // remove removed comments
      .slice(0, this.commentCount)
      .map((comment) => {
        comment.replies.sort((a, b) => b.ups - a.ups);

        return <Comment>{
          id: comment.id,
          url: `https://www.reddit.com${comment.permalink}`,
          body: comment.body,
          ups: comment.ups,

          topReply: {
            id: comment.replies[0].id,
            url: `https://www.reddit.com${comment.replies[0].permalink}`,
            body: comment.replies[0].body,
            ups: comment.replies[0].ups,
          },
        };
      });

    return comments;
  }

  // GETTERS AND SETTERS
  setPostId(postUrlOrId: string) {
    const isUrl = new Promise(() => new URL(postUrlOrId)).catch(() => false).then(() => true);
    let postId = "";

    if (isUrl) {
      const postUrl = new URL(postUrlOrId);
      if (!REDDIT_POST_URL_REGEX.test(postUrl.href)) {
        throw new Error("Invalid Reddit post URL");
      }

      // extract post id from url
      const path = postUrl.pathname.split("/");
      postId = path[4];
    } else {
      postId = postUrlOrId;
    }

    if (!REDDIT_POST_ID_REGEX.test(postId)) {
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

  setCommentCount(commentCount: number) {
    if (commentCount < 1) {
      throw new Error("Comment count must be greater than 0");
    } else if (commentCount > 30) {
      throw new Error("Comment count must be less than or equal to 30");
    }

    this.commentCount = commentCount;
  }

  setTopReplyShowThreshold(topReplyShowThreshold: number) {
    if (topReplyShowThreshold < 0 || topReplyShowThreshold > 1) {
      throw new Error("Top reply show threshold must be between 0 and 1");
    }

    this.topReplyShowThreshold = topReplyShowThreshold;
  }

  setVideoDimensions(videoDimensions: VideoDiemensions) {
    if (videoDimensions.width < 1 || videoDimensions.height < 1) {
      throw new Error("Video dimensions must be greater than 0");
    }

    this.videoDimensions = videoDimensions;
  }
}
