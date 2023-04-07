import Ffmpeg from "fluent-ffmpeg";
import { VideoDimensions } from "src/Shitposter";

export function useVideoDimensions(videoPath: string): Promise<VideoDimensions> {
  return new Promise((resolve, reject) => {
    Ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve({ width: metadata.streams[0].width, height: metadata.streams[0].height });
      }
    });
  });
}
