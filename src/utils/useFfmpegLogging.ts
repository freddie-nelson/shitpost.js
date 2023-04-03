import { FfmpegCommand } from "fluent-ffmpeg";

export default function useFfmpegLogging(command: FfmpegCommand) {
  command.on("start", (commandLine) => {
    console.log("Spawned Ffmpeg with command: " + commandLine);
  });
  command.on("progress", (progress) => {
    console.log(`[PROCESSING ${progress.timemark}] Frame ${progress.frames} @ ${progress.currentFps}`);
  });
  command.on("end", (err, stdout, stderr) => {
    console.log("finished processing", err, stdout, stderr);
  });

  return command;
}
