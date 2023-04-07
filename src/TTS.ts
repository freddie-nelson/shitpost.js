export default interface TTS {
  init(): Promise<void>;
  close(): Promise<void>;

  speak(text: string, voice: string): Promise<Buffer>;
}
