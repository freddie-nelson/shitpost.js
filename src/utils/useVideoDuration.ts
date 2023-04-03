import Ffmpeg from "fluent-ffmpeg";

export function useVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    Ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata.format.duration);
      }
    });
  });
}
