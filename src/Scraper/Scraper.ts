import Hero, { IHeroCreateOptions, LoadStatus } from "@ulixee/hero";
import { gracefulHeroClose, makesBusy, needsFree, needsInit } from "./classDecorators";
import { useValidURL } from "../utils/useValidURL";
import Miner from "@ulixee/miner";

export default class Scraper {
  protected name: string;
  protected heroOptions: IHeroCreateOptions;
  protected hero: Hero;
  protected miner: Miner;
  protected document: Hero["document"];

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

  constructor(name: string, heroOptions: IHeroCreateOptions) {
    this.name = name || "client";
    this.heroOptions = heroOptions;
  }

  @gracefulHeroClose()
  @needsFree()
  @makesBusy()
  async init() {
    if (this.isInitialised) {
      throw new Error(`${this.name} is already initialised.`);
    }

    console.log(`Initialising ${this.name}.`);

    this.miner = new Miner();
    const connection = await this.miner.listen();

    this.hero = new Hero({
      ...this.heroOptions,
      connectionToCore: { host: `localhost:${connection.port}` },
    });

    this.document = this.hero.document;

    this.isInitialised = true;
    console.log(`Initialised ${this.name}.`);
  }

  async close() {
    if (!this.isInitialised) return;
    if (this.isBusy) console.warn("WARN: Closing while busy may cause unexpected behaviour.");

    console.log(`Closing ${this.name}.`);

    await this.hero.close();
    await this.miner.close();

    this.hero = undefined;
    this.miner = undefined;

    this.isInitialised = false;
    this.isBusy = false;

    console.log(`Closed ${this.name}.`);
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
    if (this.heroOptions.mode === "development") console.log(`[${new Date().toISOString()} DEBUG]:`, ...args);
  }
}
