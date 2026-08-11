import { Builder } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import firefox from "selenium-webdriver/firefox.js";
import edge from "selenium-webdriver/edge.js";

export class SeleniumDriverFactory {
  static async createDriver({ browser = "chrome", headless = true } = {}) {
    const browserName = (process.env.BROWSER || browser).toLowerCase();
    const isHeadless = process.env.HEADLESS !== undefined ? process.env.HEADLESS === "true" : headless;

    let builder = new Builder().forBrowser(browserName);

    if (browserName === "chrome") {
      const options = new chrome.Options();
      if (isHeadless) {
        options.addArguments("--headless=new");
      }
      options.addArguments("--no-sandbox");
      options.addArguments("--disable-dev-shm-usage");
      options.addArguments("--disable-gpu");
      options.addArguments("--window-size=1920,1080");
      builder.setChromeOptions(options);
    } else if (browserName === "firefox") {
      const options = new firefox.Options();
      if (isHeadless) {
        options.addArguments("-headless");
      }
      options.addArguments("--width=1920");
      options.addArguments("--height=1080");
      builder.setFirefoxOptions(options);
    } else if (browserName === "edge") {
      const options = new edge.Options();
      if (isHeadless) {
        options.addArguments("--headless=new");
      }
      options.addArguments("--window-size=1920,1080");
      builder.setEdgeOptions(options);
    }

    const driver = await builder.build();
    await driver.manage().setTimeouts({ implicit: 5000, pageLoad: 30000 });
    return driver;
  }
}
