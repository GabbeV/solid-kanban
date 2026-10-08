import { chromium, firefox } from "@playwright/test";
import assert from "node:assert/strict";

for (const type of [chromium, firefox]) {
  const browser = await type.launch();

  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 800 },
    });

    const errors = [];
    const delivered = [];
    const servers = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.routeWebSocket("ws://127.0.0.1:3002/network-lab-check", (socket) => {
      servers.push(socket);
      socket.onMessage((message) => delivered.push(message));
    });
    await page.route("**/__network-lab", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><html><head><meta name="color-scheme" content="light dark"></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/network-lab.tsx"></script></body></html>',
      }),
    );
    await page.route("**/network-lab-http-check", (route) => route.fulfill({ body: "ok" }));
    const stalled = Promise.withResolvers();
    await page.route("**/network-lab-stall", (route) => {
      stalled.resolve(route);
    });
    await page.goto("http://127.0.0.1:3002/__network-lab");
    await page.waitForFunction(() => window.networkSocket?.readyState === WebSocket.OPEN);
    await page.getByRole("button", { name: /^Network lab/ }).click();

    const connect = async () => {
      await page.evaluate(() => {
        window.networkLab.configure({ delayMs: 0, jitter: 0, faultRate: 0 });
        window.networkSocket = new WebSocket("ws://127.0.0.1:3002/network-lab-check");
        window.networkSocket.addEventListener("close", (event) => {
          window.lastClose = { code: event.code, reason: event.reason };
        });
        window.networkSocket.addEventListener("error", (event) => {
          window.lastError = event.message;
        });
        window.networkSocket.addEventListener("message", (event) =>
          window.networkReceived.push(event.data),
        );
      });
      await page.waitForFunction(() => window.networkSocket.readyState === WebSocket.OPEN);

      return servers.at(-1);
    };

    // Kill a socket with queued frames, another socket, a fetch in transit,
    // and a fetch already waiting for the real server response.
    await connect();
    await page.evaluate(() => {
      window.httpOutcome = "pending";
      void fetch("/network-lab-stall").then(
        () => (window.httpOutcome = "success"),
        (error) => (window.httpOutcome = error.message),
      );
    });
    const stalledRequest = await stalled.promise;
    await page.evaluate(() => {
      window.networkLab.configure({ delayMs: 5000 });
      window.networkSocket.send("queued-first");
      window.networkSocket.send("queued-second");
      window.httpQueuedOutcome = "pending";
      void fetch("/network-lab-http-check").then(
        () => (window.httpQueuedOutcome = "success"),
        (error) => (window.httpQueuedOutcome = error.message),
      );
    });
    await page.waitForFunction(() => window.networkLab.snapshot().packets.length === 3);
    await page.getByRole("button", { name: "Kill connections", exact: true }).click();
    await page.waitForFunction(
      () => window.httpOutcome !== "pending" && window.httpQueuedOutcome !== "pending",
    );
    const killed = await page.evaluate(() => ({
      close: window.lastClose,
      error: window.lastError,
      http: window.httpOutcome,
      queuedHttp: window.httpQueuedOutcome,
      rows: window.networkLab.snapshot().rows,
      packets: window.networkLab.snapshot().packets,
    }));

    assert.equal(killed.close.code, 4000);
    assert.match(killed.close.reason, /Network lab testing error/);
    assert.match(killed.error, /Network lab testing error/);
    assert.match(killed.http, /Network lab testing error/);
    assert.match(killed.queuedHttp, /Network lab testing error/);
    assert.equal(killed.packets.length, 0);
    assert.equal(killed.rows.filter((row) => row.state === "open").length, 0);
    assert.equal(killed.rows.filter((row) => row.state === "error").length, 6);
    assert.deepEqual(delivered, []);
    await stalledRequest.fulfill({ body: "too late" }).catch(() => {});
    await page.evaluate(() => window.networkLab.configure({ delayMs: 0 }));
    assert.deepEqual(delivered, [], "Killed frames must never leak through later");
    console.log(
      `PASS ${type.name()}: kill all sockets/fetches, cancel queued frames, error reason.`,
    );

    // Unlike the one-shot kill, unplug stays disconnected across retries.
    await connect();
    const disconnect = page.getByRole("button", {
      name: "Disconnect",
      exact: true,
    });

    await disconnect.click();
    await page.waitForFunction(() => window.networkSocket.readyState === WebSocket.CLOSED);
    assert.equal(await disconnect.getAttribute("aria-pressed"), "true");
    assert.match(await page.evaluate(() => window.lastError), /kept disconnected/);
    const countBefore = servers.length;
    await page.evaluate(() => {
      window.blockedConnections = [];
      window.blockedOpens = 0;
      for (let i = 0; i < 2; i++) {
        const socket = new WebSocket("ws://127.0.0.1:3002/network-lab-check");
        socket.addEventListener("open", () => window.blockedOpens++);
        socket.addEventListener("close", (event) =>
          window.blockedConnections.push({
            code: event.code,
            reason: event.reason,
          }),
        );
      }

      window.httpOutcome = "pending";
      void fetch("/network-lab-http-check").then(
        () => (window.httpOutcome = "success"),
        (error) => (window.httpOutcome = error.message),
      );
    });
    await page.waitForFunction(
      () => window.blockedConnections.length === 2 && window.httpOutcome !== "pending",
    );
    const blocked = await page.evaluate(() => ({
      snapshot: window.networkLab.snapshot(),
      opens: window.blockedOpens,
      connections: window.blockedConnections,
      http: window.httpOutcome,
    }));

    assert.equal(blocked.snapshot.disconnected, true);
    assert.equal(blocked.snapshot.packets.length, 0);
    assert.equal(blocked.opens, 0);
    assert.equal(servers.length, countBefore, "Blocked sockets must not reach the server");
    assert.match(blocked.http, /kept disconnected/);
    for (const connection of blocked.connections) {
      assert.equal(connection.code, 4000);
      assert.match(connection.reason, /kept disconnected/);
    }

    await page.screenshot({
      path: `/tmp/network-disconnected-${type.name()}.png`,
    });
    await page.getByRole("button", { name: "Close Network lab", exact: true }).click();
    assert.match(
      await page.getByRole("button", { name: /^Network lab/ }).innerText(),
      /Disconnected/,
    );
    await page.getByRole("button", { name: /^Network lab/ }).click();
    assert.equal(await disconnect.getAttribute("aria-pressed"), "true");
    await disconnect.click();
    assert.equal(await disconnect.getAttribute("aria-pressed"), "false");
    await connect();
    assert.equal(
      await page.evaluate(async () => (await fetch("/network-lab-http-check")).text()),
      "ok",
    );
    console.log(
      `PASS ${type.name()}: sustained disconnect blocks reconnects and fetches, toggle restores transport.`,
    );

    // WebSocket trials use half the selected rate. Exactly on the boundary
    // succeeds; a value below it kills the connection.
    await connect();
    await page.evaluate(() => {
      window.networkRandom = 0.05;
      window.networkLab.configure({ faultRate: 0.1 });
      window.networkSocket.send("survives-at-boundary");
    });
    await page.waitForFunction(() => window.networkLab.snapshot().packets.length === 0);
    assert.deepEqual(delivered, ["survives-at-boundary"]);
    await page.evaluate(() => {
      window.networkRandom = 0.049;
      window.networkSocket.send("outbound-fault");
    });
    await page.waitForFunction(() => window.networkSocket.readyState === WebSocket.CLOSED);
    assert.match(await page.evaluate(() => window.lastError), /simulated connection fault/);
    assert.deepEqual(delivered, ["survives-at-boundary"]);

    const inbound = await connect();
    await page.evaluate(() => window.networkLab.configure({ faultRate: 0.1 }));
    inbound.send("inbound-fault");
    await page.waitForFunction(() => window.networkSocket.readyState === WebSocket.CLOSED);
    assert.equal(
      await page.evaluate(() => window.networkReceived.includes("inbound-fault")),
      false,
    );
    console.log(`PASS ${type.name()}: half-rate fault sampling in both WS directions.`);

    // A 10% HTTP pair has a ~5.13% chance at each leg, not 10% twice or 5% twice.
    await page.evaluate(() => {
      window.networkRandom = 0.052;
      window.networkLab.configure({ faultRate: 0.1 });
    });
    assert.equal(
      await page.evaluate(async () => (await fetch("/network-lab-http-check")).text()),
      "ok",
    );
    await page.evaluate(() => {
      window.networkRandom = 0.051;
      window.httpOutcome = "pending";
      void fetch("/network-lab-http-check").then(
        () => (window.httpOutcome = "success"),
        (error) => (window.httpOutcome = error.message),
      );
    });
    await page.waitForFunction(() => window.httpOutcome !== "pending");
    assert.match(await page.evaluate(() => window.httpOutcome), /simulated connection fault/);
    await page.evaluate(() => {
      window.networkRandom = 0.052;
      window.networkLab.configure({ delayMs: 500 });
      window.httpOutcome = "pending";
      void fetch("/network-lab-http-check").then(
        () => (window.httpOutcome = "success"),
        (error) => (window.httpOutcome = error.message),
      );
    });
    await page.waitForFunction(() =>
      window.networkLab.snapshot().packets.some((packet) => packet.direction === "in"),
    );
    await page.evaluate(() => (window.networkRandom = 0.051));
    await page.waitForFunction(() => window.httpOutcome !== "pending");
    assert.match(await page.evaluate(() => window.httpOutcome), /simulated connection fault/);
    console.log(`PASS ${type.name()}: calibrated 10% HTTP pair rate on both legs.`);

    // Fail an HTTP request before send, then a response after the server replied.
    await page.evaluate(() => {
      window.networkLab.configure({ delayMs: 0, faultRate: 1 });
      window.httpOutcome = "pending";
      void fetch("/network-lab-http-check").then(
        () => (window.httpOutcome = "success"),
        (error) => (window.httpOutcome = error.message),
      );
    });
    await page.waitForFunction(() => window.httpOutcome !== "pending");
    assert.match(await page.evaluate(() => window.httpOutcome), /simulated connection fault/);
    await page.evaluate(() => {
      window.networkLab.configure({ delayMs: 500, faultRate: 0 });
      window.httpOutcome = "pending";
      void fetch("/network-lab-http-check").then(
        () => (window.httpOutcome = "success"),
        (error) => (window.httpOutcome = error.message),
      );
    });
    await page.waitForFunction(() =>
      window.networkLab.snapshot().packets.some((packet) => packet.direction === "in"),
    );
    await page.evaluate(() => window.networkLab.configure({ faultRate: 1 }));
    await page.waitForFunction(() => window.httpOutcome !== "pending");
    assert.match(await page.evaluate(() => window.httpOutcome), /simulated connection fault/);
    assert.equal(await page.evaluate(() => window.networkLab.snapshot().packets.length), 0);
    console.log(`PASS ${type.name()}: HTTP request and response faults.`);

    // Persist controls, and check the compact and wrapped headers visually.
    await page.getByLabel("Fault rate", { exact: true }).selectOption("0.05");
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("solid-kanban:network-lab")).faultRate,
      ),
      0.05,
    );
    await page.screenshot({
      path: `/tmp/network-faults-wide-${type.name()}.png`,
    });
    await page.setViewportSize({ width: 360, height: 740 });
    await page.screenshot({
      path: `/tmp/network-faults-phone-${type.name()}.png`,
    });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    assert.equal(await page.getByLabel("Fault rate", { exact: true }).isVisible(), true);
    await page.reload();
    await page.waitForFunction(() => window.networkSocket?.readyState === WebSocket.OPEN);
    assert.equal(await page.getByLabel("Fault rate", { exact: true }).inputValue(), "0.05");
    await page.getByLabel("Fault rate", { exact: true }).selectOption("0");
    assert.deepEqual(errors, []);
    console.log(`PASS ${type.name()}: settings persistence, phone layout, no page errors.`);
  } finally {
    await browser.close();
  }
}
