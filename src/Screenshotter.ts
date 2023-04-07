import Scraper from "./Scraper/Scraper";
import { gracefulHeroClose, makesBusy, needsFree, needsInit } from "./Scraper/classDecorators";
import { Comment } from "./Shitposter";
import { usePostUrl } from "./utils/usePostUrl";

export default class Screenshotter extends Scraper {
  constructor() {
    super("Screenshotter", {
      showChrome: process.env.SCREENSHOTTER_MODE === "debug",
      mode: process.env.SCREENSHOTTER_MODE === "debug" ? "development" : "production",
      viewport: {
        width: 500,
        height: 2160,
        screenWidth: 500,
        screenHeight: 2160,
      },
      userAgent: "~ chrome >= 105 && windows >= 10",
    });
  }

  @gracefulHeroClose()
  @needsInit()
  @needsFree()
  @makesBusy()
  async screenshotPost(postId: string) {
    const url = await usePostUrl(postId);
    console.log(`Taking screenshot of post ${postId} at ${url}`);

    await this.hero.goto(url);
    await this.hero.waitForPaintingStable();
    await this.hero.waitForMillis(4000);

    console.log("Finding post");
    const postElement = await this.waitForElement(`#t3_${postId}`);
    await this.hero.waitForMillis(4000);

    console.log("Taking screenshot");
    const clientRect = await postElement.getBoundingClientRect();
    const rectangle = {
      x: await clientRect.x,
      y: await clientRect.y,
      width: await clientRect.width,
      height: await clientRect.height,
      scale: 3,
    };

    const buffer = await this.hero.takeScreenshot({ rectangle, format: "jpeg" });
    console.log(`Screenshot taken of post ${postId}`);

    return buffer;
  }

  @gracefulHeroClose()
  @needsInit()
  @needsFree()
  @makesBusy()
  async screenshotComment(comment: Comment | Comment["topReply"]) {
    console.log(`Taking screenshot of comment ${comment.id}`);

    await this.hero.goto(comment.url);
    await this.hero.waitForPaintingStable();
    await this.hero.waitForMillis(4000);

    console.log("Finding comment");
    const commentElement = await this.waitForElement(`#t1_${comment.id}`);
    await this.hero.waitForMillis(4000);

    console.log("Taking screenshot");
    const clientRect = await commentElement.getBoundingClientRect();
    const rectangle = {
      x: await clientRect.x,
      y: await clientRect.y,
      width: await clientRect.width,
      height: await clientRect.height,
      scale: 3,
    };

    const buffer = await this.hero.takeScreenshot({ rectangle, format: "jpeg" });
    console.log(`Screenshot taken of comment ${comment.id}`);

    return buffer;
  }
}
