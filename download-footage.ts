const fs = require("fs");
const ytdl = require("ytdl-core");

const folder = "./background-footage";

if (!fs.existsSync(folder)) {
  console.log("Creating background footage folder");
  fs.mkdirSync(folder);
}

const downloadVideo = async (url: string, name: string) => {
  console.log(`Downloading ${name}.mp4`);

  return new Promise<void>((resolve, reject) => {
    const stream = ytdl(url, {
      filter: (format: any) => format.itag === 299, // 1080p60 mp4
    });

    stream.on("end", () => {
      console.log(`Finished downloading ${name}.mp4`);
      resolve();
    });

    stream.on("error", (err: Error) => {
      console.error(`Error downloading ${name}.mp4`);
      console.error(err);
      reject(err);
    });

    stream.pipe(fs.createWriteStream(`${folder}/${name}.mp4`));
  });
};

(async () => {
  console.log("Downloading background footage");

  await Promise.allSettled([
    downloadVideo("https://www.youtube.com/watch?v=JJFCIFr50n0", "minecraft-1"),
    downloadVideo("https://www.youtube.com/watch?v=Pt5_GSKIWQM", "minecraft-2"),
    downloadVideo("https://www.youtube.com/watch?v=a5B8Xx1RPSc", "minecraft-3"),
    downloadVideo("https://www.youtube.com/watch?v=875A5jdmn8k", "minecraft-4"),
    downloadVideo("https://www.youtube.com/watch?v=dvjy6V4vLlI", "subway-surfers-1"),
    downloadVideo("https://www.youtube.com/watch?v=B0omVjRlaeA", "clash-royale-1"),
    downloadVideo("https://www.youtube.com/watch?v=iuB8M22xJ_8", "csgo-surf-1"),
  ]);

  console.log("Finished downloading footage");
})();
