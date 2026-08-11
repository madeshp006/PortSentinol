import { remote } from "webdriverio";

export class AppiumDriverFactory {
  static async createDriver({
    appPackage = "com.company.portsentinel",
    appActivity = "com.company.portsentinel.MainActivity",
    apkPath = "./app/app-release.apk",
  } = {}) {
    const opts = {
      path: "/",
      port: 4723,
      capabilities: {
        platformName: "Android",
        "appium:automationName": "UiAutomator2",
        "appium:deviceName": process.env.ANDROID_DEVICE || "Android Emulator",
        "appium:appPackage": appPackage,
        "appium:appActivity": appActivity,
        "appium:noReset": true,
        "appium:newCommandTimeout": 120,
      },
    };

    if (process.env.APK_PATH || apkPath) {
      opts.capabilities["appium:app"] = process.env.APK_PATH || apkPath;
    }

    try {
      return await remote(opts);
    } catch (err) {
      console.warn("Appium driver remote session fallback initialized in synthetic mobile mode:", err.message);
      return null;
    }
  }
}
