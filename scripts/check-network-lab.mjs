import { chromium, firefox } from "@playwright/test";
import assert from "node:assert/strict";

for (const browserType of [chromium, firefox]) {
  const browser = await browserType.launch();

  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 800 },
      ...(browserType === chromium ? { permissions: ["local-network-access"] } : {}),
    });

    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const receivedOutgoing = [];
    let server;
    await page.routeWebSocket("ws://127.0.0.1:3002/network-lab-check", (socket) => {
      server = socket;
      socket.onMessage((message) => {
        receivedOutgoing.push(message);
        if (message === "round-trip-check") socket.send(message);
      });
    });
    await page.route("**/__network-lab", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><html><head><meta name="color-scheme" content="light dark"></head><body><div id="root"></div><script type="module" src="/scripts/fixtures/network-lab.tsx"></script></body></html>',
      }),
    );
    await page.route("**/network-lab-http-check", (route) => route.fulfill({ body: "ok" }));
    await page.goto("http://127.0.0.1:3002/__network-lab");
    await page.waitForFunction(() => window.networkSocket?.readyState === WebSocket.OPEN);

    const configure = (delayMs, jitter = 0, sample = 0.75) =>
      page.evaluate(
        ({ delayMs, jitter, sample }) => {
          window.networkRandom = sample;
          window.networkLab.configure({ delayMs, jitter });
        },
        { delayMs, jitter, sample },
      );

    // Zero variation: a WS echo and HTTP request/response each take one RTT.
    await configure(1000);
    const elapsed = await page.evaluate(async () => {
      const start = performance.now();
      await new Promise((resolve) => {
        const received = (event) => {
          if (event.data !== "round-trip-check") return;

          window.networkSocket.removeEventListener("message", received);
          resolve();
        };

        window.networkSocket.addEventListener("message", received);
        window.networkSocket.send("round-trip-check");
      });
      const ws = performance.now() - start;
      const httpStart = performance.now();
      await fetch("/network-lab-http-check");

      return { ws, http: performance.now() - httpStart };
    });

    for (const [kind, duration] of Object.entries(elapsed)) {
      assert.ok(
        duration >= 1000 && duration < 1500,
        `${kind} should add 1000ms round-trip delay, got ${duration}ms`,
      );
    }

    console.log(`PASS (${browserType.name()}): WS and HTTP round-trip timing.`, elapsed);
    await page.evaluate(() => {
      window.networkReceived.length = 0;
    });
    receivedOutgoing.length = 0;

    const send = async (direction, label) => {
      if (direction === "in") server.send(label);
      else await page.evaluate((label) => window.networkSocket.send(label), label);
    };

    const waitProgress = (direction, progress) =>
      page.waitForFunction(
        ({ direction, progress }) =>
          window.networkLab
            .snapshot()
            .packets.some(
              (packet) => packet.direction === direction && packet.progress >= progress,
            ),
        { direction, progress },
        { timeout: 10000 },
      );

    const samplePlayback = (direction, kind = "websocket") =>
      page.evaluate(
        ({ direction, kind }) => {
          const snapshot = window.networkLab.snapshot();
          const row = snapshot.rows.find(
            (row) => row.kind === kind && (kind === "http" || row.direction === direction),
          );

          const label = [...document.querySelectorAll("[title]")].find((element) =>
            element.textContent.startsWith(
              kind === "http" ? "HTTP" : direction === "in" ? "WS ←" : "WS →",
            ),
          );

          const track = label.nextElementSibling;
          const dots = [...track.querySelectorAll("span[aria-hidden=true]")];
          const packets = snapshot.packets.filter((packet) => packet.rowId === row.id);

          return packets.map((packet, index) => {
            const dot = dots[index];
            const position = packet.direction === "in" ? 1 - packet.progress : packet.progress;

            return {
              ...packet,
              x: dot.getBoundingClientRect().x,
              expectedX:
                track.getBoundingClientRect().x +
                track.clientLeft +
                position * (track.clientWidth - dot.offsetWidth),
            };
          });
        },
        { direction, kind },
      );

    // Wait for elapsed animation frames, without seeking or changing dot positions.
    const observe = () =>
      page.evaluate(async () => {
        const start = performance.now();
        while (performance.now() - start < 200) await new Promise(requestAnimationFrame);
      });

    const assertPositions = (packets, direction) => {
      for (const [index, packet] of packets.entries()) {
        assert.ok(
          Math.abs(packet.x - packet.expectedX) < 1,
          "Dot position must match transport progress",
        );
        if (index > 0) {
          assert.ok(
            packet.progress <= packets[index - 1].progress,
            "Later messages must remain behind earlier messages",
          );
          assert.ok(
            direction === "in"
              ? packet.x >= packets[index - 1].x - 0.01
              : packet.x <= packets[index - 1].x + 0.01,
            "Dots must not overtake",
          );
        }
      }
    };

    const toggle = () => page.getByRole("button", { name: /Network lab/ }).click();
    let incomingCount = 0;
    for (const direction of ["in", "out"]) {
      for (const jitter of [0, 1]) {
        await configure(4000, jitter);
        const labels = [0, 1, 2].map((index) => `${direction}:${jitter}:${index}`);
        const outgoingCount = receivedOutgoing.length + 3;
        incomingCount += direction === "in" ? 3 : 0;
        if (direction === "out") await toggle();
        await send(direction, labels[0]);
        await waitProgress(direction, 0.1);
        await send(direction, labels[1]);
        await waitProgress(direction, 0.2);
        await send(direction, labels[2]);
        await page.waitForFunction(
          (direction) =>
            window.networkLab.snapshot().packets.filter((packet) => packet.direction === direction)
              .length === 3,
          direction,
        );
        if (direction === "in") await toggle(); // Mount mid-flight.
        const before = await samplePlayback(direction);
        await observe();
        const after = await samplePlayback(direction);
        assert.equal(after.length, 3);
        assertPositions(before, direction);
        assertPositions(after, direction);
        const distance = after[0].progress - before[0].progress;
        assert.ok(distance > 0.02, "Dots must advance naturally");
        after.forEach((packet, index) =>
          assert.ok(
            Math.abs(packet.progress - before[index].progress - distance) < 1e-9,
            "Messages share the channel's changing speed",
          ),
        );
        const node = await page
          .locator('dialog[aria-label="Network lab"] span[aria-hidden=true]')
          .first()
          .elementHandle();

        await observe();
        assert.equal(
          await node.evaluate((element) => element.isConnected),
          true,
          "Progress updates must preserve dot elements",
        );
        await toggle();
        if (direction === "in") {
          await page.waitForFunction(
            (count) => window.networkReceived.length === count,
            incomingCount,
          );
          assert.deepEqual(await page.evaluate(() => window.networkReceived.slice(-3)), labels);
        } else {
          await page.waitForFunction(() => window.networkLab.snapshot().packets.length === 0);
          // Transport callbacks follow the final progress publication in microtasks.
          await page.evaluate(() => Promise.resolve());
          assert.equal(receivedOutgoing.length, outgoingCount);
          assert.deepEqual(receivedOutgoing.slice(-3), labels);
        }

        console.log(
          `PASS (${browserType.name()}): ${direction}, variation ${jitter}; playback, shared speed, DOM stability and FIFO delivery.`,
        );
      }
    }

    await configure(10000);
    await toggle();
    await send("in", "speed-change");
    await waitProgress("in", 0.1);
    const slowBefore = await samplePlayback("in");
    await observe();
    const slowAfter = await samplePlayback("in");
    await configure(2000);
    const fastBefore = await samplePlayback("in");
    await observe();
    const fastAfter = await samplePlayback("in");
    assert.ok(
      fastAfter[0].progress - fastBefore[0].progress >
        3 * (slowAfter[0].progress - slowBefore[0].progress),
      "Changing transit speed must affect messages already in flight",
    );
    await configure(0);
    await page.waitForFunction(() => window.networkReceived.at(-1) === "speed-change");
    assert.equal(await page.evaluate(() => window.networkLab.snapshot().packets.length), 0);
    console.log(`PASS (${browserType.name()}): live delay changes and real-speed draining.`);

    // Independent channel conditions; changing variation eases toward a new speed.
    await configure(6000, 1, 0.1);
    await send("out", "slow-channel");
    await page.evaluate(() => {
      window.networkRandom = 0.9;
    });
    await send("in", "fast-channel");
    await page.waitForFunction(() => window.networkLab.snapshot().packets.length === 2);
    const outBefore = await samplePlayback("out");
    const inBefore = await samplePlayback("in");
    await observe();
    const outAfter = await samplePlayback("out");
    const inAfter = await samplePlayback("in");
    assert.ok(
      inAfter[0].progress - inBefore[0].progress >
        4 * (outAfter[0].progress - outBefore[0].progress),
      "WS directions must have independent conditions",
    );
    await configure(6000, 1, 0.9);
    const easingBefore = await samplePlayback("out");
    await observe();
    const easingAfter = await samplePlayback("out");
    const newDistance = easingAfter[0].progress - easingBefore[0].progress;
    assert.ok(
      newDistance > outAfter[0].progress - outBefore[0].progress,
      "Speed should approach its faster target",
    );
    assert.ok(newDistance < 0.11, "Speed should ease rather than immediately jump to the target");
    await configure(0);
    await page.waitForFunction(() => window.networkLab.snapshot().packets.length === 0);
    console.log(`PASS (${browserType.name()}): independent directions and smooth variation.`);

    await configure(2000);
    await page.evaluate(() => {
      window.httpOutcome = "pending";
      void fetch("/network-lab-http-check")
        .then((response) => response.text())
        .then((value) => {
          window.httpOutcome = value;
        });
    });
    await waitProgress("out", 0.1);
    const httpOut = await samplePlayback("out", "http");
    await observe();
    const httpOutAfter = await samplePlayback("out", "http");
    assert.ok(httpOutAfter[0].x > httpOut[0].x);
    assertPositions(httpOutAfter, "out");
    await waitProgress("in", 0.1);
    const httpIn = await samplePlayback("in", "http");
    assert.equal(httpIn[0].rowId, httpOut[0].rowId);
    assert.equal(await page.evaluate(() => window.httpOutcome), "pending");
    await observe();
    const httpInAfter = await samplePlayback("in", "http");
    assert.ok(httpInAfter[0].x < httpIn[0].x);
    assertPositions(httpInAfter, "in");
    await page.waitForFunction(() => window.httpOutcome === "ok");
    console.log(
      `PASS (${browserType.name()}): HTTP outbound and return playback follows actual delivery.`,
    );

    await page.evaluate(() => {
      const controller = new AbortController();
      window.abortHttp = () => controller.abort();
      window.httpOutcome = "pending";
      void fetch("/network-lab-http-check", {
        signal: controller.signal,
      }).catch((error) => {
        window.httpOutcome = error.name;
      });
    });
    await waitProgress("out", 0.1);
    await page.evaluate(() => window.abortHttp());
    await page.waitForFunction(() => window.httpOutcome === "AbortError");
    assert.equal(await page.evaluate(() => window.networkLab.snapshot().packets.length), 0);
    assert.deepEqual(errors, []);
    console.log(`PASS (${browserType.name()}): cancellation; no page errors.`);
  } finally {
    await browser.close();
  }
}
