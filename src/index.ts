import { writeFile } from "fs/promises";
import ShitpostCreator from "./Shitposter";
import TTS from "./TTS/TTS";

const shitposter = new ShitpostCreator(
  "https://www.reddit.com/r/AskReddit/comments/l7530r/how_would_you_feel_about_reddit_adding_3_nsfw/",
  "C:\\Users\\user\\Desktop\\test.mp4",
  10
);

// shitposter.createShitpost();

(async () => {
  const tts = new TTS();
  await tts.init();

  const buffer = await tts.speak(
    "Hello I am dwayne the rock johnson and I like fat cocks up my asshole.",
    "mr-krabs"
  );
  await writeFile("./audio.wav", buffer);

  await tts.close();
})();
