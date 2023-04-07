import fetch from "node-fetch";
import TTS from "./TTS";

export default class TwitchTTS implements TTS {
  async init() {
    return;
  }

  async close() {
    return;
  }

  async speak(text: string, voice: "Brian" | "Joey") {
    console.log("Starting speech synthesis");

    text = text.replace("<speak", "").replace("</speak>", "");
    if (text.length > 10000) throw new Error("Text is too long. (Max 10000 characters");

    let current = 0;
    const maxPartSize = 1000;
    const parts: string[] = [];

    while (current < text.length) {
      const part = text.slice(current, maxPartSize);
      parts.push(part);

      current += part.length;
    }

    const body = JSON.stringify(
      parts.map((p) => ({
        voiceId: `Amazon British English (${voice})`,
        ssml: `<speak version="1.0" xml:lang="en-GB">${p}</speak>`,
      }))
    );

    console.log("Converting text");
    const res = await fetch("https://support.readaloud.app/ttstool/createParts", {
      headers: {
        accept: "*/*",
        "accept-language": "en-GB,en;q=0.5",
        "content-type": "application/json",
        "sec-ch-ua": '"Brave";v="111", "Not(A:Brand";v="8", "Chromium";v="111"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        "sec-gpc": "1",
      },
      // referrer: "https://ttstool.com/",
      // referrerPolicy: "strict-origin-when-cross-origin",
      body,
      method: "POST",
      // mode: "cors",
      // credentials: "omit",
    });

    console.log("Downloading audio");

    const ids: string[] = await res.json();
    let audio = Buffer.alloc(0);

    for (const id of ids) {
      const res = await fetch(`https://support.readaloud.app/ttstool/getParts?q=${id}`, {
        headers: {
          accept: "*/*",
          "accept-language": "en-GB,en;q=0.5",
          range: "bytes=0-",
          "sec-ch-ua": '"Brave";v="111", "Not(A:Brand";v="8", "Chromium";v="111"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "audio",
          "sec-fetch-mode": "no-cors",
          "sec-fetch-site": "cross-site",
          "sec-gpc": "1",
        },
        // referrer: "https://ttstool.com/",
        // referrerPolicy: "strict-origin-when-cross-origin",
        body: null,
        method: "GET",
        // mode: "cors",
        // credentials: "omit",
      });

      const audioPart = Buffer.from(await res.arrayBuffer());
      audio = Buffer.concat([audio, audioPart]);
    }

    console.log("Outputing buffer");
    return audio;
  }
}
