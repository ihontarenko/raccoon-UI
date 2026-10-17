const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { mkdirSync, writeFileSync } = require("node:fs");
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/Ivan_Hontarenko/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright",
);

async function compareScreenshots(reference, application, scenario, nativePaintDifferences) {
  const mask = (page) =>
    scenario.route === "jmouse-uik" ? { mask: [page.locator("#brand-gallery")] } : {};
  await reference.bringToFront();
  const expected = await reference.screenshot(mask(reference));
  await application.bringToFront();
  const actual = await application.screenshot(mask(application));
  const digest = (pixels) => createHash("sha256").update(pixels).digest("hex");
  if (digest(actual) === digest(expected)) {
    return;
  }
  const difference = await application.evaluate(
    async ([first, second]) => {
      async function pixels(source) {
        const image = new Image();
        image.src = source;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        return {
          data: context.getImageData(0, 0, image.width, image.height).data,
          width: image.width,
          height: image.height,
        };
      }
      const expectedPixels = await pixels(first);
      const actualPixels = await pixels(second);
      const controls = [
        ...document.querySelectorAll(".query-main > svg, .query-filters select"),
      ].map((element) => element.getBoundingClientRect());
      let count = 0;
      let outsideControls = 0;
      for (let offset = 0; offset < expectedPixels.data.length; offset += 4) {
        if (
          [0, 1, 2, 3].some(
            (channel) =>
              expectedPixels.data[offset + channel] !== actualPixels.data[offset + channel],
          )
        ) {
          count += 1;
          const x = (offset / 4) % expectedPixels.width;
          const y = Math.floor(offset / 4 / expectedPixels.width);
          if (
            !controls.some(
              (rectangle) =>
                x >= rectangle.left - 1 &&
                x <= rectangle.right + 1 &&
                y >= rectangle.top - 1 &&
                y <= rectangle.bottom + 1,
            )
          ) {
            outsideControls += 1;
          }
        }
      }
      return {
        count,
        outsideControls,
        fraction: count / (expectedPixels.width * expectedPixels.height),
      };
    },
    [
      `data:image/png;base64,${expected.toString("base64")}`,
      `data:image/png;base64,${actual.toString("base64")}`,
    ],
  );
  // Chromium can paint native query controls differently after asynchronous font loading.
  // Permit only this measured region; all its DOM, computed styles and geometry must match.
  const renderedStyles = (page) =>
    page.locator(".shell").evaluate((shell) =>
      [...shell.querySelectorAll("*")].map((element) => ({
        rectangle: element.getBoundingClientRect().toJSON(),
        css: Object.fromEntries(
          [...getComputedStyle(element)]
            .filter((property) => !property.startsWith("--"))
            .map((property) => [
              property,
              getComputedStyle(element).getPropertyValue(property).replace(/\b0%/g, "0px"),
            ]),
        ),
      })),
    );
  assert.deepEqual(
    await renderedStyles(application),
    await renderedStyles(reference),
    `${scenario.route}: rendered styles or layout differ`,
  );
  mkdirSync(".scratch/parity", { recursive: true });
  const name = `${scenario.route}-${scenario.width}-${scenario.theme}`;
  writeFileSync(`.scratch/parity/${name}-reference.png`, expected);
  writeFileSync(`.scratch/parity/${name}-application.png`, actual);
  assert.equal(scenario.route, "index", `${name}: unexpected screenshot difference`);
  assert.equal(scenario.width, 390, `${name}: unexpected screenshot difference`);
  assert.equal(
    difference.outsideControls,
    0,
    `${name}: pixels differ outside native query controls`,
  );
  assert.ok(difference.fraction < 0.005, `${name}: screenshot difference exceeds 0.5%`);
  nativePaintDifferences.push({ ...scenario, ...difference });
}

async function verify() {
  const browser = await chromium.launch({ headless: true });
  try {
    const reference = await browser.newPage({ reducedMotion: "reduce" });
    const application = await browser.newPage({ reducedMotion: "reduce" });
    const errors = [];
    application.on("pageerror", (error) => errors.push(error.message));
    application.on("response", (response) => {
      if (response.status() >= 400) {
        errors.push(`${response.status()} ${response.url()}`);
      }
    });
    const routes = [
      "index",
      "context",
      "answers",
      "sources",
      "projects",
      "documents",
      "jobs",
      "access",
      "evaluation",
      "system",
      "jmouse-uik",
    ];
    const base = process.env.UI_URL || "http://127.0.0.1:5100";
    const design = process.env.DESIGN_URL || "http://127.0.0.1:4186";
    const nativePaintDifferences = [];
    let comparisons = 0;
    for (const theme of ["light", "dark"]) {
      for (const width of [1440, 768, 390]) {
        for (const route of routes) {
          for (const [page, origin] of [
            [reference, design],
            [application, base],
          ]) {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto(`${origin}/${route}.html`);
            await page.locator("h1").waitFor();
            await page.evaluate((currentTheme) => {
              Appearance.set("theme", currentTheme);
              Appearance.sync();
            }, theme);
            await page.evaluate(() => document.fonts.ready);
            if (route === "jmouse-uik") {
              await page.locator("#brand-motion-toggle").waitFor();
            }
          }
          assert.equal(
            await application.locator(".shell").innerHTML(),
            await reference.locator(".shell").innerHTML(),
            `${route} DOM differs`,
          );
          assert.equal(
            await application.title(),
            await reference.title(),
            `${route} title differs`,
          );
          await compareScreenshots(
            reference,
            application,
            { route, width, theme },
            nativePaintDifferences,
          );
          assert.equal(
            await application.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
            false,
            `${route} overflow`,
          );
          comparisons += 1;
        }
      }
    }
    await application.goto(`${base}/system.html`);
    await application.getByRole("heading", { name: "Система", exact: true }).waitFor();
    await application.getByRole("button", { name: "Налаштувати вигляд" }).click();
    await application.getByLabel("Термінал", { exact: true }).check();
    await application.getByLabel("Великий", { exact: true }).check();
    await application.getByLabel("Code + Onest", { exact: true }).check();
    assert.equal(await application.locator("html").getAttribute("data-palette"), "terminal");
    assert.equal(await application.locator("html").getAttribute("data-scale"), "1.3");
    assert.equal(await application.locator("html").getAttribute("data-font"), "hybrid");
    await application.keyboard.press("Escape");
    assert.equal(await application.locator("dialog[open]").count(), 0);
    await application.reload();
    await application.locator("h1").waitFor();
    assert.equal(await application.locator("html").getAttribute("data-palette"), "terminal");
    await application.getByRole("button", { name: "Навігація", exact: true }).click();
    assert.equal(await application.locator("#navigation").getAttribute("class"), "side open");
    await application.keyboard.press("Escape");
    assert.equal(await application.locator("#navigation").getAttribute("class"), "side");
    await application.reload();
    await application.locator("h1").waitFor();
    await application.keyboard.press("Tab");
    assert.equal(await application.evaluate(() => document.activeElement.className), "skip");
    await application.keyboard.press("Enter");
    assert.equal(await application.evaluate(() => document.activeElement.id), "main");
    assert.deepEqual(errors, []);
    const report = {
      comparisons,
      domParity: "exact",
      metadataParity: "exact",
      exactScreenshotComparisons: comparisons - nativePaintDifferences.length,
      animatedGallery: "masked",
      nativePaintDifferences,
      appearancePersistence: "passed",
      mobileNavigation: "passed",
      keyboardSkipLink: "passed",
      pageAndNetworkErrors: errors,
    };
    mkdirSync(".scratch/parity", { recursive: true });
    writeFileSync(".scratch/parity/report.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
