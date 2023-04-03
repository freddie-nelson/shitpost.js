import ShitpostCreator from "./Shitposter";

const shitposter = new ShitpostCreator(
  "https://www.reddit.com/r/AskReddit/comments/129j5h3/if_there_is_ice_cream_in_zootopia_who_is_getting/",
  "C:\\Users\\fredd\\Documents\\programming\\shitpost.js\\background-footage\\csgo-surf-1.mp4",
  5,
  0.8,
  "siri-male-british"
);

shitposter.createShitpost();

// (async () => {
//   const tts = new TTS();
//   await tts.init();

//   const buffer = await tts.speak(
//     "Hello I am dwayne the rock johnson and I like fat cocks up my asshole.",
//     "mr-krabs"
//   );
//   await writeFile("./audio.wav", buffer);

//   await tts.close();
// })();
