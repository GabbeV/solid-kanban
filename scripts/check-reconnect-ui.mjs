import assert from "node:assert/strict";
import { chromium, firefox } from "@playwright/test";

for (const type of [chromium, firefox]) {
  const browser = await type.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      ...(type === chromium ? { permissions: ["local-network-access"] } : {}),
    });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem(
        "solid-kanban:network-lab",
        JSON.stringify({ delayMs: 0, jitter: 0, faultRate: 0 }),
      );
      localStorage.setItem("solid-kanban:network-lab:open", "false");
    });
    await page.goto("http://127.0.0.1:3002/b/studio");
    await page
      .locator("[data-lane-id] article[data-card-id]")
      .first()
      .waitFor();
    const boardCards = () =>
      page.locator("[data-lane-id] article[data-card-id]").evaluateAll((els) =>
        els.map((el) => ({
          id: el.dataset.cardId,
          lane: el.closest("[data-lane-id]").dataset.laneId,
        })),
      );
    const original = await boardCards();
    assert.ok(original.length >= 2);
    await page.getByRole("button", { name: /^Network lab/ }).click();
    await page
      .getByLabel("Round-trip delay", { exact: true })
      .selectOption("60000");
    const moving = original.slice(0, 2);
    for (const { id, lane: source } of moving) {
      const target = original.find((card) => card.lane !== source).lane;
      const card = page.locator(`[data-lane-id] article[data-card-id="${id}"]`);
      const sourceBox = await card.boundingBox();
      const lane = page.locator(`[data-lane-id="${target}"]`);
      const laneBox = await lane.boundingBox();
      const first = await lane
        .locator("article[data-card-id]")
        .first()
        .boundingBox();
      await page.mouse.move(sourceBox.x + 30, sourceBox.y + 40);
      await page.mouse.down();
      await page.mouse.move(laneBox.x + laneBox.width / 2, first.y + 1, {
        steps: 6,
      });
      await page.mouse.up();
      await page.waitForFunction(
        (id) =>
          [...document.querySelectorAll(`[data-card-id="${id}"] span`)].some(
            (el) => getComputedStyle(el).animationName.includes("spinner"),
          ),
        id,
        { timeout: 3000 },
      );
    }
    await page.getByRole("button", { name: "Disconnect", exact: true }).click();
    for (const { id } of moving) {
      const card = page.locator(`[data-lane-id] article[data-card-id="${id}"]`);
      await card.getByRole("status").waitFor({ timeout: 2000 });
      assert.match(
        await card.getByRole("status").innerText(),
        /Changes not confirmed/,
      );
      assert.equal(
        await card
          .locator("span")
          .evaluateAll((els) =>
            els.some((el) =>
              getComputedStyle(el).animationName.includes("spinner"),
            ),
          ),
        false,
      );
    }
    for (const { id } of moving) {
      await page
        .locator(`[data-lane-id] article[data-card-id="${id}"]`)
        .getByRole("button", { name: "Discard changes", exact: true })
        .click();
    }
    assert.deepEqual(
      await boardCards(),
      original,
      "Failure/discard must settle while still offline",
    );
    await page.getByRole("link", { name: "Archive", exact: true }).click();
    await page
      .getByRole("status", { name: "Loading archive", exact: true })
      .waitFor();
    await page
      .getByLabel("Round-trip delay", { exact: true })
      .selectOption("0");
    await page.getByRole("button", { name: "Disconnect", exact: true }).click();
    await page
      .getByRole("status", { name: "Loading archive", exact: true })
      .waitFor({ state: "detached", timeout: 25000 });
    await page.getByRole("link", { name: "Board", exact: true }).click();
    await page
      .locator("[data-lane-id] article[data-card-id]")
      .first()
      .waitFor();
    assert.deepEqual(await boardCards(), original);
    await page.reload();
    await page
      .locator("[data-lane-id] article[data-card-id]")
      .first()
      .waitFor();
    assert.deepEqual(
      await boardCards(),
      original,
      "Interrupted outbound moves must not modify the database",
    );
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${type.name()}: concurrent move failures and discard reveal offline; new archive waits; reconnection and SSR reload recover without persisted moves.`,
    );
  } finally {
    await browser.close();
  }
}
