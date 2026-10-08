import { chromium, firefox } from "@playwright/test";
import assert from "node:assert/strict";
for (const type of [chromium, firefox]) {
  const browser = await type.launch();

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      ...(type === chromium ? { permissions: ["local-network-access"] } : {}),
    });

    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:3002/b/studio");
    const dock = page.getByRole("dialog", { name: "Network lab" });
    const bubble = await dock.boundingBox();
    assert.ok(bubble.width < 260 && bubble.height >= 33 && bubble.height < 60);
    assert.ok(bubble.x > 1000 && bubble.y > 800);
    await page.screenshot({ path: `/tmp/network-bubble-${type.name()}.png` });
    await page.getByRole("button", { name: /Network lab/ }).click();
    await page.getByLabel("Round-trip delay").selectOption("2500");
    await page.getByLabel("Speed variation").selectOption("0.5");
    const initial = await dock.boundingBox();
    assert.ok(Math.abs(initial.x - 16) < 1 && Math.abs(initial.y + initial.height - 884) < 1);
    const handle = await page
      .getByRole("separator", {
        name: "Resize network lab height",
        exact: true,
      })
      .boundingBox();

    await page.mouse.move(handle.x + handle.width / 2, handle.y + 5);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2, handle.y - 95, {
      steps: 8,
    });
    await page.mouse.up();
    const taller = await dock.boundingBox();
    assert.ok(taller.height > initial.height + 90);
    const corner = await page
      .getByRole("separator", { name: "Resize network lab", exact: true })
      .boundingBox();

    await page.mouse.move(corner.x + 12, corner.y + 12);
    await page.mouse.down();
    await page.mouse.move(corner.x + 332, corner.y + 52, { steps: 8 });
    await page.mouse.up();
    const resized = await dock.boundingBox();
    assert.ok(resized.width < initial.width - 300);
    assert.ok(resized.height < taller.height - 30);
    assert.ok(Math.abs(resized.x + resized.width - 1264) < 1);
    await page.getByRole("link", { name: "Activity", exact: true }).click();
    await page.waitForFunction(() =>
      document.querySelector('dialog[aria-label="Network lab"] span[aria-hidden=true]'),
    );
    await page.screenshot({
      path: `/tmp/network-dock-light-${type.name()}.png`,
    });
    await page.getByRole("button", { name: /Network lab/ }).click();
    await page.getByRole("button", { name: /Network lab/ }).click();
    assert.equal(Math.round((await dock.boundingBox()).width), Math.round(resized.width));
    await page.emulateMedia({ colorScheme: "dark" });
    await page.screenshot({
      path: `/tmp/network-dock-dark-${type.name()}.png`,
    });
    await page.setViewportSize({ width: 360, height: 740 });
    await page.screenshot({
      path: `/tmp/network-dock-phone-${type.name()}.png`,
    });
    const phone = await dock.boundingBox();
    assert.ok(
      phone.x >= 7 && phone.x + phone.width <= 353 && phone.y >= 7 && phone.y + phone.height <= 733,
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      false,
    );
    await page.getByLabel("Round-trip delay").selectOption("0");
    await page.waitForURL("**/b/studio/activity");
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${type.name()}: bubble, height and corner resizing, collapse/reopen, mobile bounds and navigation.`,
    );
  } finally {
    await browser.close();
  }
}
