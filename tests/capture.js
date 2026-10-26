// Read-only capture of the running local demo; never connects to personal browser profiles.
import { chromium } from "@playwright/test";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  await page.goto("http://localhost:4173");
  await page
    .getByRole("button", { name: "Ver detalhes de Break a leg", exact: true })
    .waitFor();
  await page.screenshot({ path: "docs/preview.png" });
} finally {
  await browser.close();
}
