import assert from "node:assert/strict";
import { chromium, firefox } from "@playwright/test";

for (const type of [chromium, firefox]) {
  const browser = await type.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("http://127.0.0.1:3002/__subscriptions", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<div id="root"></div><script type="module" src="/scripts/fixtures/subscriptions.tsx"></script>',
      }),
    );
    await page.goto("http://127.0.0.1:3002/__subscriptions");
    await page.waitForFunction(() => !!window.fixture);
    const count = () =>
      page.evaluate(() => window.fixture.registrations.length);
    const value = (id) => page.locator(`#${id}`).innerText();
    const waitRows = (id, title = "One") =>
      page.waitForFunction(
        ({ id, title }) =>
          document.getElementById(id)?.textContent.includes(title),
        { id, title },
      );
    await page.evaluate(() => window.fixture.add("existing"));
    await page.waitForFunction(() => window.fixture.registrations.length === 1);
    assert.equal(await value("existing"), "Pending");
    await page.evaluate(() => window.fixture.apply(0));
    await waitRows("existing");
    const snapshot = await value("existing");

    await page.evaluate(() => {
      window.firstMove = "pending";
      void window.fixture.move().then(
        () => (window.firstMove = "saved"),
        (error) => (window.firstMove = error.message),
      );
    });
    await page.waitForFunction(() => window.fixture.reducerCalls.length === 1);
    await page.evaluate(() => window.fixture.disconnect());
    await page.waitForFunction(() => window.firstMove !== "pending");
    assert.match(
      await page.evaluate(() => window.firstMove),
      /outcome is unknown/,
    );
    assert.equal(await value("existing"), snapshot);
    assert.equal(
      await page.evaluate(() => window.fixture.listeners.update.size),
      0,
    );
    await page.evaluate(() => window.fixture.add("new"));
    assert.equal(await value("new"), "Pending");
    assert.equal(
      await count(),
      1,
      "Do not subscribe through the disconnected session",
    );
    await page.evaluate(() => window.fixture.add("disposed"));
    await page.evaluate(() => window.fixture.remove("disposed"));

    await page.evaluate(() => window.fixture.reconnect());
    await page.waitForFunction(() => window.fixture.registrations.length === 2);
    assert.equal(
      await value("existing"),
      snapshot,
      "Keep the snapshot while reapplying subscriptions",
    );
    assert.equal(await value("new"), "Pending");
    assert.equal(await page.locator("#disposed").count(), 0);
    await page.evaluate(() => window.fixture.apply(1));
    await waitRows("new");
    assert.equal(await value("existing"), snapshot);
    await page.evaluate(() => window.fixture.update("A", "After reconnect"));
    await waitRows("existing", "After reconnect");
    await waitRows("new", "After reconnect");

    // A second disconnect before acknowledgement must move pending readers
    // to the next session without making loaded readers pending again.
    await page.evaluate(() => window.fixture.disconnect());
    await page.evaluate(() => {
      window.offlineMove = "pending";
      void window.fixture.move().then(() => (window.offlineMove = "saved"));
    });
    assert.equal(
      await page.evaluate(() => window.fixture.reducerCalls.length),
      1,
    );
    // Another failed connection attempt must not strand calls awaiting readiness.
    await page.evaluate(() => window.fixture.disconnect());
    await page.evaluate(() => window.fixture.add("pending"));
    await page.evaluate(() => window.fixture.reconnect());
    await page.waitForFunction(() => window.fixture.registrations.length === 3);
    await page.waitForFunction(() => window.fixture.reducerCalls.length === 2);
    await page.evaluate(() => window.fixture.reducerCalls[1].resolve());
    await page.waitForFunction(() => window.offlineMove === "saved");
    await page.evaluate(() => window.fixture.reducerCalls[0].resolve());
    assert.match(
      await page.evaluate(() => window.firstMove),
      /outcome is unknown/,
    );
    assert.equal(await value("pending"), "Pending");
    await page.evaluate(() => window.fixture.disconnect());
    await page.evaluate(() => window.fixture.reconnect());
    await page.waitForFunction(() => window.fixture.registrations.length === 4);
    await waitRows("existing", "After reconnect");
    await page.evaluate(() => window.fixture.apply(2)); // Obsolete acknowledgement.
    assert.equal(await value("pending"), "Pending");
    await page.evaluate(() => window.fixture.apply(3));
    await waitRows("pending", "After reconnect");

    await page.evaluate(() =>
      ["existing", "new", "pending"].forEach((id) => window.fixture.remove(id)),
    );
    assert.equal(
      await page.evaluate(() => window.fixture.listeners.update.size),
      0,
    );
    assert.equal(
      await page.evaluate(() => window.fixture.registrations[3].unsubscribed),
      true,
    );
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${type.name()}: retained snapshots, offline mounts, pending restoration, repeated reconnects, obsolete callbacks and cleanup.`,
    );
  } finally {
    await browser.close();
  }
}
