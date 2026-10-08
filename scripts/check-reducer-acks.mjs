import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const context = await browser.newContext({
  permissions: ["local-network-access"],
});
const control = await context.newPage();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.stack));
let boardId;
try {
  await control.route("**/__ack-control", (r) =>
    r.fulfill({ contentType: "text/html", body: "<!doctype html>" }),
  );
  await control.goto("http://127.0.0.1:3002/__ack-control");
  boardId = await control.evaluate(async () => {
    const { DbConnection } = await import("/src/module_bindings/index.ts");
    const db = await new Promise((resolve, reject) =>
      DbConnection.builder()
        .withUri("ws://127.0.0.1:3001")
        .withDatabaseName("solid-kanban")
        .onConnect(resolve)
        .onConnectError((_, e) => reject(e))
        .build(),
    );
    window.db = db;
    const id = crypto.randomUUID();
    await db.reducers.createBoard({
      boardId: id,
      actor: "Acknowledgment test",
      title: "Initial",
      description: "",
      sequence: 0n,
    });
    return id;
  });
  await page.route("**/__event-ack?*", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<div id="root"></div><script type="module" src="/scripts/fixtures/reducer-acks.tsx"></script>',
    }),
  );
  await page.goto("http://127.0.0.1:3002/__event-ack?board=" + boardId);
  await page.waitForFunction(
    () => document.getElementById("title")?.textContent === "Initial",
  );
  await page.evaluate(() => {
    window.events = [];
    window.fixtureDb.db.reducerAck.onInsert((_, event) => {
      const board = [...window.fixtureDb.db.board.iter()][0];
      window.events.push({
        sequence: String(event.sequence),
        title: board.title,
      });
    });
    window.fixture.run("Held 1").catch((e) => {
      window.runError = e.message;
    });
  });
  await page.waitForFunction(() => !!window.fixture.releases["Held 1"]);
  assert.equal(
    await page.locator("#title").innerText(),
    "Initial",
    "Confirmed cache must remain held by the action",
  );
  assert.deepEqual(await page.evaluate(() => window.events), [
    { sequence: "1", title: "Held 1" },
  ]);
  assert.equal(
    await page.evaluate(() => window.fixtureDb.db.reducerAck.count()),
    0n,
  );
  await page.evaluate(() => window.fixture.releases["Held 1"]());
  await page.waitForFunction(
    () => document.getElementById("title")?.textContent === "Held 1",
  );
  const error = await page.evaluate(async () => {
    try {
      await window.fixture.fail();
    } catch (e) {
      return e.message;
    }
  });
  assert.match(error, /no longer exists/);
  assert.equal(
    await page.evaluate(() => window.events.length),
    1,
    "Failed transactions must emit no acknowledgment",
  );
  await page.evaluate(() => window.fixture.noop());
  assert.equal(
    await page.evaluate(() => window.events.at(-1).sequence),
    "3",
    "No-op successes still acknowledge, despite sequence gap",
  );
  await page.evaluate(() => {
    window.fixture.run("Held 2").catch((e) => {
      window.runError = e.message;
    });
  });
  await page.waitForFunction(() => !!window.fixture.releases["Held 2"]);
  assert.equal(await page.locator("#title").innerText(), "Held 1");
  await page.evaluate(() => window.fixture.releases["Held 2"]());
  await page.waitForFunction(
    () => document.getElementById("title")?.textContent === "Held 2",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS real event callbacks: cache delivery held until action ends; rollback emits no ack; no-op success and sequence gaps work; event cache remains empty.",
  );
} finally {
  if (boardId)
    await control.evaluate(async (id) => {
      await window.db.reducers.deleteBoard({
        boardId: id,
        actor: "Acknowledgment test",
        sequence: 0n,
      });
      window.db.disconnect();
    }, boardId);
  await browser.close();
}
