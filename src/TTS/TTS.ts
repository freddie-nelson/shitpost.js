import { config } from "dotenv";
import Hero, { ISuperElement, LoadStatus } from "@ulixee/hero-playground";
import { gracefulHeroClose, makesBusy, needsFree, needsInit } from "./classDecorators";
import { useValidURL } from "../utils/useValidURL";

// Load environment variables
config();

export default class TTS {
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

  protected hero: Hero;
  protected document: Hero["document"];

  // URLS
  protected HOME_URL = "https://app.uberduck.ai/";
  protected LOGIN_URL = "https://auth.uberduck.ai/login";
  protected TTS_URL = `${this.HOME_URL}speak`;

  // CLIENT STATE FLAGS
  protected isInitialised = false;
  getIsInitialised() {
    return this.isInitialised;
  }

  protected isBusy = false;
  getIsBusy() {
    return this.isBusy;
  }
  getIsFree() {
    return !this.isBusy;
  }

  constructor() {}

  @gracefulHeroClose()
  @needsFree()
  @makesBusy()
  async init() {
    if (this.isInitialised) {
      throw new Error("TTS is already initialised.");
    }

    console.log("Initialising TTS.");

    this.hero = new Hero({
      showChrome: process.env.TTS_MODE === "debug",
      mode: process.env.TTS_MODE === "debug" ? "development" : "production",
      viewport: {
        width: 1920,
        height: 1080,
      },
      userAgent: "~ chrome >= 105 && windows >= 10",
    });
    this.document = this.hero.document;

    this.isInitialised = true;
    console.log("Initialised TTS.");

    this.isBusy = false;
    await this.login();
  }

  async close() {
    if (!this.isInitialised) return;
    if (this.isBusy) console.warn("WARN: Closing while busy may cause unexpected behaviour.");

    console.log("Closing TTS.");

    await this.hero.close();
    this.hero = undefined;

    this.isInitialised = false;
    this.isBusy = false;

    console.log("Closed TTS.");
  }

  @gracefulHeroClose()
  @needsFree()
  @needsInit()
  @makesBusy()
  async speak(text: string, voice: typeof this.voices[number]) {
    console.log("Starting speech synthesis");

    await this.hero.goto(`${this.TTS_URL}#mode=tts-basic&voice=${voice}`);

    console.log("Converting text");
    const textArea = await this.waitForElement("textarea");
    await this.hero.waitForMillis(2000);
    await this.hero.click(textArea);
    await this.hero.type(text);

    // find synthesize button
    const synthesizeButton = await this.findElementWithText("button", "Synthesize");
    await synthesizeButton.click();

    // wait for audio
    const sinceCommandId = await this.hero.lastCommandId;
    console.log("Waiting for audio file");

    await this.waitForElement("wave");
    console.log("Found audio wave");

    const resource = await this.hero.waitForResource(
      { url: /.*audio\.wav$/ },
      { timeoutMs: 30 * 1000, sinceCommandId }
    );

    console.log("Outputing buffer");
    const buffer = await resource.buffer;
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

  @needsInit()
  protected async waitForUrl(
    url: string,
    exactMatch: boolean = false,
    timeout?: number,
    checksIntervalMs?: number
  ) {
    const getTabUrl = () => this.hero.activeTab.url;

    return this.waitFor(
      async () => (exactMatch ? (await getTabUrl()) === url : (await getTabUrl()).includes(url)),
      timeout,
      checksIntervalMs
    );
  }

  @needsInit()
  protected async waitForNoElementWithText(
    selector: string,
    text: string,
    timeout?: number,
    exactMatch?: boolean,
    caseSensitive?: boolean,
    checksIntervalMs?: number
  ) {
    this.debugLog(`Waiting for no '${selector}' element to exist with textContent '${text}'.`);

    return this.waitFor(
      async () => !(await this.findElementWithText(selector, text, exactMatch, caseSensitive)),
      timeout,
      checksIntervalMs
    );
  }

  @needsInit()
  protected async waitForElementWithText(
    selector: string,
    text: string,
    timeout?: number,
    exactMatch?: boolean,
    caseSensitive?: boolean,
    checksIntervalMs?: number
  ) {
    this.debugLog(`Waiting for '${selector}' element to exist with textContent '${text}'.`);

    return this.waitFor(
      () => this.findElementWithText(selector, text, exactMatch, caseSensitive),
      timeout,
      checksIntervalMs
    );
  }

  @needsInit()
  protected async findElementWithText(
    selector: string,
    text: string,
    exactMatch = true,
    caseSensitive = false
  ) {
    this.debugLog(
      `Finding '${selector}' element with textContent ${exactMatch ? "of" : "containing"} '${text}'.`
    );
    const elements = await this.document.querySelectorAll(selector);

    if (!caseSensitive) text = text.toLowerCase();

    for (const el of elements) {
      let elText = (await el.textContent) || "";
      if (!caseSensitive) elText = elText.toLowerCase();

      if (exactMatch && elText === text) return el;
      else if (elText.includes(text)) return el;
    }

    return null;
  }

  @needsInit()
  protected async waitForNoElement(selector: string, timeout?: number, checksIntervalMs?: number) {
    this.debugLog(`Waiting for no element to exist with selector '${selector}'.`);

    return this.waitFor(async () => !(await this.querySelector(selector, true)), timeout, checksIntervalMs);
  }

  @needsInit()
  protected async waitForElement(selector: string, timeout?: number, checksIntervalMs?: number) {
    this.debugLog(`Waiting for element with selector '${selector}' to exist.`);

    return this.waitFor(() => this.querySelector(selector), timeout, checksIntervalMs);
  }

  /**
   * Waits for a value to be truthy.
   *
   * NOTE: `this.document` and maybe other variables will not work inside a waitForValue call for some reason.
   *       If you need to access the document, do so via another function call.
   *
   * @param waitForValue The value to wait for to be truthy
   * @param timeout The time in ms before timing out, throws after timeout
   * @param checksIntervalMs The time in ms between value checks
   * @returns The last value returned from waitForValue
   */
  @needsInit()
  protected async waitFor<T>(waitForValue: () => Promise<T>, timeout = 10e3, checksIntervalMs = 100) {
    return new Promise<T>((resolve, reject) => {
      let timedOut = false;
      const id = timeout
        ? setTimeout(() => {
            timedOut = true;
          }, timeout)
        : null;

      (async () => {
        let value: T;
        while (!timedOut && !(value = await waitForValue())) {
          await this.hero.waitForMillis(checksIntervalMs);
        }
        if (timedOut) {
          reject();
          return;
        }

        if (id !== null) clearTimeout(id);
        resolve(value);
      })();
    });
  }

  @needsInit()
  protected async querySelector(selector: string, silent = false) {
    if (!silent) this.debugLog(`Selecting element '${selector}'.`);

    const element = await this.document.querySelector(selector);
    if (!element) {
      if (!silent) this.debugLog(`Could not find any element with selector '${selector}'.`);
      return null;
    }

    return element;
  }

  @needsInit()
  protected async goto(href: string, skipIfAlreadyOnUrl = false, waitForStatus?: LoadStatus) {
    const url = useValidURL(href);
    if (!url) throw new Error(`'goto' requires a valid URL, '${url}' is not valid.`);

    const currUrl = new URL(await this.hero.url);
    if (
      skipIfAlreadyOnUrl &&
      (currUrl.href === url.href ||
        (currUrl.href.endsWith("/") && currUrl.href.substring(0, currUrl.href.length - 1) === url.href))
    )
      return;

    this.debugLog(`Navigating to '${url.href}'.`);
    await this.hero.goto(url.href);
    this.debugLog("Navigated, waiting for page to load.");
    try {
      await this.waitForLoad(waitForStatus);
    } catch (error) {
      this.debugLog("Waiting for page load failed, waiting for additional 2 seconds and continuing.");
      this.debugLog("waitForLoad Error (can ignore):", error);
      await this.hero.waitForMillis(2e3);
    }
    this.debugLog(`Opened '${url.href}'.`);
  }

  /**
   * Calls waitForNavigation if `hero.url` includes `match`.
   *
   * @param match The string to match for in the url
   * @param trigger The waitForLocation trigger
   * @param status The waitForLoad status to wait for from the page
   */
  @needsInit()
  protected async waitForNavigationConditional(
    match: string,
    trigger: "change" | "reload" = "change",
    status?: LoadStatus
  ) {
    if ((await this.hero.url).includes(match)) await this.waitForNavigation(trigger, status);
  }

  /**
   * Calls hero's waitForLocation and then waitForLoad.
   *
   * @param trigger The waitForLocation trigger
   * @param status The waitForLoad status to wait for from the page
   */
  @needsInit()
  protected async waitForNavigation(trigger: "change" | "reload" = "change", status?: LoadStatus) {
    await this.hero.waitForLocation(trigger);
    await this.waitForLoad(status);
  }

  @needsInit()
  protected async waitForLoad(status: LoadStatus = LoadStatus.AllContentLoaded) {
    await this.hero.waitForLoad(status);
  }

  protected debugLog(...args: any[]) {
    if (process.env.TTS_MODE === "debug") console.log(`[${new Date().toISOString()} DEBUG]:`, ...args);
  }
}
