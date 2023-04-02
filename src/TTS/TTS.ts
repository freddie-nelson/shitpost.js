import { config } from "dotenv";
import Hero, { ISuperElement, LoadStatus } from "@ulixee/hero-playground";
import { gracefulHeroClose, makesBusy, needsFree, needsInit } from "./classDecorators";
import { useValidURL } from "../utils/useValidURL";

// Load environment variables
config();

export default class TTS {
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
      throw new Error("Client is already initialised.");
    }

    this.hero = new Hero({
      showChrome: process.env.TTS_MODE === "debug",
    });
    this.document = this.hero.document;

    this.isInitialised = true;

    this.isBusy = false;
    await this.login();
  }

  async close() {
    if (!this.isInitialised) return;
    if (this.isBusy) console.warn("WARN: Closing while busy may cause unexpected behaviour.");

    console.log("Closing client.");

    await this.hero.close();
    this.hero = undefined;

    this.isInitialised = false;
    this.isBusy = false;

    console.log("Closed client.");
  }

  @gracefulHeroClose()
  @needsFree()
  @needsInit()
  @makesBusy()
  async speak(text: string, voice: "the-rock" = "the-rock") {
    await this.hero.goto(`${this.TTS_URL}#mode=tts-basic&voice=${voice}`);

    const textArea = await this.waitForElement("textarea");
    await this.hero.click(textArea);
    await this.hero.type(text);

    // find synthesize button
    const synthesizeButton = await this.findElementWithText("button", "Synthesize");
    await this.hero.click(synthesizeButton);

    // wait for audio
    const resource = await this.hero.waitForResource({ url: /.*audio\.wav$/ }, { timeoutMs: 300 * 1000 });

    const buffer = await resource.buffer;
    return buffer;
  }

  @gracefulHeroClose()
  @needsFree()
  @makesBusy()
  protected async login() {
    await this.goto(this.LOGIN_URL);

    const emailInput = await this.waitForElement("input#email");
    const passwordInput = await this.waitForElement("input#password");

    // find login button
    const loginButton = await this.findElementWithText("button", "Log In");

    await this.hero.click(emailInput);
    await this.hero.type(process.env.TTS_EMAIL);

    await this.hero.click(passwordInput);
    await this.hero.type(process.env.TTS_PASSWORD);

    await this.hero.click(loginButton);
    await this.waitForUrl(this.HOME_URL);
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
    console.log(`Waiting for no '${selector}' element to exist with textContent '${text}'.`);

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
    console.log(`Waiting for '${selector}' element to exist with textContent '${text}'.`);

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
    console.log(
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
    console.log(`Waiting for no element to exist with selector '${selector}'.`);

    return this.waitFor(async () => !(await this.querySelector(selector, true)), timeout, checksIntervalMs);
  }

  @needsInit()
  protected async waitForElement(selector: string, timeout?: number, checksIntervalMs?: number) {
    console.log(`Waiting for element with selector '${selector}' to exist.`);

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
    if (!silent) console.log(`Selecting element '${selector}'.`);

    const element = await this.document.querySelector(selector);
    if (!element) {
      if (!silent) console.log(`Could not find any element with selector '${selector}'.`);
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

    console.log(`Navigating to '${url.href}'.`);
    await this.hero.goto(url.href);
    console.log("Navigated, waiting for page to load.");
    try {
      await this.waitForLoad(waitForStatus);
    } catch (error) {
      console.log("Waiting for page load failed, waiting for additional 2 seconds and continuing.");
      console.log("waitForLoad Error (can ignore):", error);
      await this.hero.waitForMillis(2e3);
    }
    console.log(`Opened '${url.href}'.`);
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
}
