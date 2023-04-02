import Snoowrap from "snoowrap";
import isValidPath from "is-valid-path";
import { config } from "dotenv";

// Load environment variables
config();

const REDDIT_POST_URL_REGEX =
  /^https:\/\/www\.reddit\.com\/r\/[a-zA-Z0-9]+\/comments\/[a-zA-Z0-9]+\/[a-zA-Z0-9_]+\/?$/;
const REDDIT_POST_ID_REGEX = /^[a-zA-Z0-9]+$/;

export interface Comment {
  id: string;
  url: string;
  body: string;

  topReply: Omit<Comment, "topReply">;
}

export default class Shitposter {
  protected postId: string;
  protected backgroundVideoPath: string;
  protected commentCount: number;

  constructor(postUrlOrId: string, backgroundVideoPath: string, commentCount = 10) {
    this.setPostId(postUrlOrId);
    this.setBackgroundVideoPath(backgroundVideoPath);
    this.setCommentCount(commentCount);
  }

  public async createShitpost() {
    const comments = await this.getPostComments();
    console.log(comments);

    this.getCommentTTS(comments[0]);
  }

  protected getCommentTTS(comment: Comment) {
    const utter = new SpeechSynthesisUtterance(comment.body);
    speechSynthesis.speak(utter);
  }

  protected async getPostComments() {
    const r = this.createSnoowrapRequester();

    const post = r.getSubmission(this.postId);

    // sort by top
    post.comments.sort((a, b) => b.ups - a.ups);

    const comments = post.comments
      .filter((c) => c.body !== "[removed]") // remove removed comments
      .slice(0, this.commentCount)
      .map((comment) => {
        comment.replies.sort((a, b) => b.ups - a.ups);

        return <Comment>{
          id: comment.id,
          url: comment.permalink,
          body: comment.body,

          topReply: {
            id: comment.replies[0].id,
            url: comment.replies[0].permalink,
            body: comment.replies[0].body,
          },
        };
      });

    return comments;
  }

  protected createSnoowrapRequester() {
    const requesterOptions = {
      userAgent: "shitposter.js",
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      username: process.env.REDDIT_USERNAME,
      password: process.env.REDDIT_PASSWORD,
    };

    return new Snoowrap(requesterOptions);
  }

  // GETTERS AND SETTERS

  public setPostId(postUrlOrId: string) {
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

  public setBackgroundVideoPath(backgroundVideoPath: string) {
    if (!isValidPath(backgroundVideoPath)) {
      throw new Error("Invalid path");
    }

    this.backgroundVideoPath = backgroundVideoPath;
  }

  public setCommentCount(commentCount: number) {
    if (commentCount < 1) {
      throw new Error("Comment count must be greater than 0");
    } else if (commentCount > 30) {
      throw new Error("Comment count must be less than or equal to 30");
    }

    this.commentCount = commentCount;
  }
}
