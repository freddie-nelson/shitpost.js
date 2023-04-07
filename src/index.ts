import { writeFile } from "fs/promises";
import ShitpostCreator from "./Shitposter";
import TTS from "./UberduckTTS";

const shitposter = new ShitpostCreator(
  "https://www.reddit.com/r/AskReddit/comments/mlczdu/youre_offered_the_ability_to_absorb_the_knowledge/",
  "C:\\Users\\fredd\\Documents\\programming\\shitpost.js\\background-footage",
  60,
  10,
  0.8
);

shitposter.createShitpost();

// (async () => {
//   const tts = new TTS();
//   await tts.init();

//   const buffer = await tts.speak(
//     "Rice cooker. That fucker kept me fed during depression when I barely had the energy to get out of bed. Takes less than nothing to get some rice in there and flip the switch. Want something sweet? Throw coconut and sugar in there. Want flavor but can’t be fucked to make anything? Get some spanish rice or saffron goin. You can throw tofu in there with it if you need . Yeah it’s not the best for you but hot food is better than no food.",
//     "siri-male-british"
//   );
//   await writeFile("./audio.wav", buffer);

//   await tts.close();
// })();
