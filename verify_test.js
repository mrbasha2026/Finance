const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.screenshot({ path: "C:/Users/HP/AppData/Local/Temp/verify_01_login.png" });
  console.log("STEP1: login page loaded");

  const inputs = await page.$$eval("input", els => els.map(e => ({ type: e.type, name: e.name, placeholder: e.placeholder })));
  console.log("INPUTS:", JSON.stringify(inputs));

  await browser.close();
})();
