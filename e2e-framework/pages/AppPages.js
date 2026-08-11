import { By } from "selenium-webdriver";
import { BasePage } from "./BasePage.js";

export class AuthPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.emailInput = By.css('input[type="email"], input[placeholder*="email" i]');
    this.passwordInput = By.css('input[type="password"]');
    this.submitBtn = By.css('button[type="submit"]');
    this.signInTab = By.xpath("//button[contains(text(), 'Sign In')]");
    this.signUpTab = By.xpath("//button[contains(text(), 'Sign Up')]");
    this.errorMessage = By.css(".text-red-500, [role='alert']");
  }

  async login(email, password) {
    if (await this.isDisplayed(this.signInTab)) {
      await this.click(this.signInTab);
    }
    if (email) await this.type(this.emailInput, email);
    if (password) await this.type(this.passwordInput, password);
    await this.click(this.submitBtn);
  }
}

export class ScanPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.targetInput = By.css('input[placeholder*="127.0.0.1" i], input[type="text"]');
    this.startBtn = By.xpath("//button[contains(text(), 'Start Scan') or contains(text(), 'Start Workflow')]");
    this.quickSelect127 = By.xpath("//button[contains(text(), '127.0.0.1')]");
    this.credentialedCheckbox = By.css('input[type="checkbox"]');
  }

  async runScan(target = "127.0.0.1") {
    if (await this.isDisplayed(this.quickSelect127)) {
      await this.click(this.quickSelect127);
    } else {
      await this.type(this.targetInput, target);
    }
    await this.click(this.startBtn);
  }
}

export class ResultsPage extends BasePage {
  constructor(driver) {
    super(driver);
    this.externalTab = By.xpath("//button[contains(text(), 'External Findings')]");
    this.credentialedTab = By.xpath("//button[contains(text(), 'Internal Credentialed')]");
    this.fixIssuesBtn = By.xpath("//button[contains(text(), 'Fix Issues')]");
    this.exportPdfBtn = By.xpath("//button[contains(text(), 'Export PDF')]");
  }
}
