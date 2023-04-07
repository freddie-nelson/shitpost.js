import { config } from "dotenv";
import { gracefulHeroClose, makesBusy, needsFree, needsInit } from "./Scraper/classDecorators";
import Scraper from "./Scraper/Scraper";
import ExecuteJsCorePlugin from "@ulixee/execute-js-plugin/lib/CorePlugin";
import ExecuteJsClientPlugin from "@ulixee/execute-js-plugin/lib/ClientPlugin";
import { KeyboardKey } from "@ulixee/hero";
import TTS from "./TTS";

// Load environment variables
config();

export type Voice = typeof UberduckTTS.prototype.voices[number];

export default class UberduckTTS extends Scraper implements TTS {
  readonly voices = [
    "the-rock",
    "carlisle-cullen",
    "sea-captain",
    "thomas-narrator",
    "simon-cowell",
    "spongebob-vocodes",
    "yoda",
    "mr-krabs",
    "mj",
    "jerry-seinfeld",
    "bill-nye",
    "albert-einstein",
    "mordecai",
    "eminem-arpa2",
    "2pac-arpa",
    "ken-barrie",
    "barack-obama",
    "michaelrosen",
    "peppa-narrator",
    "winston",
    "johnny-cash",
    "mike-wazowski",
    "sully",
    "roz",
    "xp-narrator",
    "ms-cortana",
    "forza-4-satnav",
    "marlin",
    "cleveland-brown",
    "peter-griffin",
    "stewie-griffin-classic",
    "oblivion-guard",
    "4th-doctor",
    "gru",
    "lightning-mcqueen",
    "mater",
    "barney-03",
    "siri-male-british",
    "siri-female-british",
    "michael-caine",
    "will-smith-talking",
    "flik",
    "hopper",
    "mikoto-misaka",
    "hal-9000",
  ] as const;

  // URLS
  protected HOME_URL = "https://app.uberduck.ai/";
  protected LOGIN_URL = "https://auth.uberduck.ai/login";
  protected TTS_URL = `${this.HOME_URL}speak`;

  constructor() {
    super(
      "TTS",
      {
        showChrome: process.env.TTS_MODE === "debug",
        mode: process.env.TTS_MODE === "debug" ? "development" : "production",
        viewport: {
          width: 1920,
          height: 1080,
          screenWidth: 1920,
          screenHeight: 1080,
        },
        userAgent: "~ chrome >= 105 && windows >= 10",
      },
      [ExecuteJsClientPlugin],
      [ExecuteJsCorePlugin]
    );
  }

  @gracefulHeroClose()
  @needsFree()
  async init() {
    await super.init();

    this.isBusy = false;
    await this.login();
  }

  @gracefulHeroClose()
  @needsFree()
  @needsInit()
  @makesBusy()
  async speak(text: string, voice: Voice) {
    console.log("Starting speech synthesis");

    const url = `${this.TTS_URL}#mode=tts-basic&voice=${voice}`;
    await this.hero.goto(url);
    await this.hero.waitForMillis(2000);

    console.log("Converting text");
    const textArea = await this.waitForElement("textarea");
    await this.hero.waitForMillis(2000);

    // @ts-expect-error
    await this.hero.executeJs((text) => {
      const textArea = document.querySelector("textarea");
      textArea.value = text;
    }, text);

    await this.hero.click(textArea);
    await this.hero.type(" ", KeyboardKey.Backspace);

    // find synthesize button
    const synthesizeButton = await this.findElementWithText("button", "Synthesize");
    await synthesizeButton.click();

    // wait for audio
    const sinceCommandId = await this.hero.lastCommandId;
    console.log("Waiting for audio file");

    const resource = await this.hero.waitForResource(
      { url: /.*audio\.wav$/ },
      { timeoutMs: 300 * 1000, sinceCommandId }
    );

    // await this.waitForElement("wave", 300 * 1000);
    // console.log("Found audio wave");

    console.log("Outputing buffer");
    const buffer = await resource.buffer;
    await this.hero.waitForMillis(2000);
    return buffer;
  }

  @gracefulHeroClose()
  @needsFree()
  @makesBusy()
  protected async login() {
    console.log("Logging in to TTS.");
    await this.goto(this.LOGIN_URL);

    const emailInput = await this.waitForElement("input#email");
    const passwordInput = await this.waitForElement("input#password");

    // find login button
    const loginButton = await this.findElementWithText("button", "Log In");

    console.log("Inputting credentials");
    await this.hero.click(emailInput);
    await this.hero.type(process.env.TTS_EMAIL);

    await this.hero.click(passwordInput);
    await this.hero.type(process.env.TTS_PASSWORD);

    await this.hero.click(loginButton);
    await this.waitForUrl(this.HOME_URL);
    console.log("Logged in to TTS.");
  }
}
