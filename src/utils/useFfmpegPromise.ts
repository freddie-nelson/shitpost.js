import { FfmpegCommand } from "fluent-ffmpeg";

export function useFfmpegPromise(command: FfmpegCommand) {
  return new Promise((resolve, reject) => {
    command.on("end", (err, stdout, stderr) => {
      if (err) {
        console.error(err, stdout, stderr);
        reject(err);
      } else {
        resolve(stdout);
      }
    });
  });
}
