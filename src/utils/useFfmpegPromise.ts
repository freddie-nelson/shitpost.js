import { FfmpegCommand } from "fluent-ffmpeg";
import { readFile } from "fs/promises";

export function useFfmpegPromise(command: FfmpegCommand) {
  return new Promise<Buffer>((resolve, reject) => {
    const outputFile = (<any>command)["_outputs"][0].target;

    command.on("end", async (err, stdout, stderr) => {
      if (err) {
        console.error(err, stdout, stderr);
        reject(err);
      } else {
        resolve(await readFile(outputFile));
      }
    });
  });
}
