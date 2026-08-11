import { By, until } from "selenium-webdriver";

export class BasePage {
  constructor(driver) {
    this.driver = driver;
    this.timeout = 10000;
  }

  async navigateTo(url) {
    await this.driver.get(url);
  }

  async waitForElement(locator, timeout = this.timeout) {
    return await this.driver.wait(until.elementLocated(locator), timeout);
  }

  async waitForElementVisible(locator, timeout = this.timeout) {
    const el = await this.waitForElement(locator, timeout);
    await this.driver.wait(until.elementIsVisible(el), timeout);
    return el;
  }

  async click(locator) {
    const el = await this.waitForElementVisible(locator);
    await el.click();
  }

  async type(locator, text) {
    const el = await this.waitForElementVisible(locator);
    await el.clear();
    await el.sendKeys(text);
  }

  async getText(locator) {
    const el = await this.waitForElementVisible(locator);
    return await el.getText();
  }

  async isDisplayed(locator) {
    try {
      const el = await this.driver.findElement(locator);
      return await el.isDisplayed();
    } catch {
      return false;
    }
  }

  async scrollToElement(locator) {
    const el = await this.waitForElement(locator);
    await this.driver.executeScript("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", el);
  }

  async captureFailureArtifact(testName) {
    const screenshot = await this.driver.takeScreenshot();
    const currentUrl = await this.driver.getCurrentUrl();
    return { screenshot, currentUrl };
  }
}
