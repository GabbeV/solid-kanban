import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch();
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
  const reset = async () => {
    await page.goto("http://127.0.0.1:3002/__subscriptions");
    await page.waitForFunction(() => !!window.fixture);
  };
  const count = () => page.evaluate(() => window.fixture.registrations.length);
  const pending = async (id) => assert.equal(await page.locator(`#${id}`).innerText(), "Pending");
  const rows = async (id, ids) => {
    await page.waitForFunction(
      ({ id, ids }) => {
        try {
          return (
            JSON.stringify(
              JSON.parse(document.getElementById(id).textContent).map((row) => row.id),
            ) === JSON.stringify(ids)
          );
        } catch {
          return false;
        }
      },
      { id, ids },
    );
  };

  await reset();
  const checks = await page.evaluate(async () => {
    const { isQueryCovered } = await import("/src/spacetimedb.tsx");
    const { tables } = await import("/src/module_bindings/index.ts");
    const {
      BooleanExpr,
      Identity,
      Timestamp,
      Uuid,
      ConnectionId,
      evaluateBooleanExpr,
      getQueryWhereClause,
    } = await import("/node_modules/.vite/deps/spacetimedb.js");
    let checks = 0;
    const test = (expected, query, existing) => {
      checks++;
      if (isQueryCovered(query, existing) !== expected)
        throw new Error(`Coverage check ${checks} failed`);
    };
    const q = (predicate) => tables.board.where(predicate);
    const A = q((r) => r.id.eq("A"));
    const B = q((r) => r.id.eq("B"));
    const blue = q((r) => r.color.eq("blue"));
    test(true, A, [tables.board]);
    test(false, A, []);
    test(false, tables.board, [A]);
    test(
      true,
      q((r) => r.id.eq("A").and(r.color.eq("blue"))),
      [A],
    );
    test(false, A, [q((r) => r.id.eq("A").and(r.color.eq("blue")))]);
    test(
      true,
      q((r) => r.color.eq("blue").and(r.id.eq("A"))),
      [q((r) => r.id.eq("A").and(r.color.eq("blue")))],
    );
    test(false, A, [B]);
    test(
      true,
      q((r) => r.id.eq("A").or(r.id.eq("B"))),
      [A, B],
    );
    test(
      false,
      q((r) => r.id.eq("A").or(r.id.eq("C"))),
      [A, B],
    );
    test(true, A, [q((r) => r.id.ne("B"))]);
    test(
      true,
      q((r) => r.id.eq("A").not().not()),
      [A],
    );
    test(true, tables.board, [q((r) => r.id.eq("A")), q((r) => r.id.eq("A").not())]);
    test(false, A, [tables.card]);
    test(
      true,
      q((r) => r.id.eq("A").and(r.id.eq("B"))),
      [blue],
    );
    // Range relationships remain conservative; exact predicates still match.
    test(
      false,
      q((r) => r.id.gt("B")),
      [q((r) => r.id.gt("A"))],
    );
    test(
      true,
      q((r) => r.id.gt("A")),
      [q((r) => r.id.gt("A"))],
    );
    for (const make of [
      (n) => new Identity(n),
      (n) => new Timestamp(n),
      (n) => new Uuid(n),
      (n) => new ConnectionId(n),
    ]) {
      test(
        true,
        q((r) => r.id.eq(make(1n))),
        [q((r) => r.id.eq(make(1n)))],
      );
      test(
        false,
        q((r) => r.id.eq(make(1n))),
        [q((r) => r.id.eq(make(2n)))],
      );
    }
    // Exhaustively check every accepted proof against a finite row domain.
    const predicates = [
      tables.board,
      A,
      B,
      blue,
      q((r) => r.id.eq("A").and(r.color.eq("blue"))),
      q((r) => r.id.eq("A").or(r.color.eq("blue"))),
      q((r) => r.id.eq("A").not().and(r.color.eq("blue"))),
      q((r) => r.id.ne("B")),
      q((r) => r.id.eq("A").and(r.color.eq("blue")).not()),
      q((r) => r.id.eq("A").and(r.id.eq("B"))),
      q(
        (r) =>
          new BooleanExpr({
            type: "eq",
            left: { type: "literal", value: "A" },
            right: r.id,
          }),
      ),
    ];
    const matches = (query, row) => {
      const predicate = getQueryWhereClause(query);
      return !predicate || evaluateBooleanExpr(predicate, row);
    };
    for (const query of predicates)
      for (const a of predicates)
        for (const b of predicates) {
          checks++;
          if (!isQueryCovered(query, [a, b])) continue;
          for (const id of ["A", "B", "C"])
            for (const color of ["blue", "red"]) {
              const row = { id, color };
              if (matches(query, row) && !matches(a, row) && !matches(b, row))
                throw new Error("Unsound coverage proof");
            }
        }
    return checks;
  });
  console.log(
    `PASS: ${checks} predicate checks, including reordered terms, unions, negation, SDK literal values, and exhaustive coverage soundness.`,
  );

  await page.evaluate(() => window.fixture.add("all"));
  await pending("all");
  await page.evaluate(() => window.fixture.apply(0));
  await rows("all", ["A", "B", "C"]);
  await page.evaluate(() => {
    window.fixture.add("a", (r) => r.id.eq("A"));
    window.fixture.add("a2", (r) => r.id.eq("A"));
  });
  await rows("a", ["A"]);
  await rows("a2", ["A"]);
  assert.equal(await count(), 1);
  await page.evaluate(() => {
    window.fixture.remove("all");
    window.fixture.update("A", "Changed");
  });
  await page.waitForFunction(
    () =>
      document.getElementById("a").textContent.includes("Changed") &&
      document.getElementById("a2").textContent.includes("Changed"),
  );
  assert.equal(await page.evaluate(() => window.fixture.registrations[0].unsubscribed), false);
  await page.evaluate(() => {
    window.fixture.remove("a");
    window.fixture.remove("a2");
  });
  await page.waitForFunction(
    () =>
      window.fixture.registrations[0].unsubscribed && window.fixture.listeners.update.size === 0,
  );
  console.log(
    "PASS: covered readers load immediately, retain the supplying subscription, receive cache updates, and release all listeners/subscriptions.",
  );

  await reset();
  await page.evaluate(() => {
    window.fixture.add("p", (r) => r.id.eq("A").and(r.color.eq("blue")));
    window.fixture.add("p2", (r) => r.color.eq("blue").and(r.id.eq("A")));
    window.fixture.add("other", (r) => r.id.eq("B"));
  });
  await pending("p");
  await pending("p2");
  await pending("other");
  assert.equal(await count(), 2);
  await page.evaluate(() => window.fixture.apply(0));
  await rows("p", ["A"]);
  await rows("p2", ["A"]);
  await pending("other");
  await page.evaluate(() => window.fixture.apply(1));
  await rows("other", ["B"]);
  console.log(
    "PASS: equivalent pending queries share one acknowledgement; unrelated queries wait independently.",
  );

  await reset();
  await page.evaluate(() => {
    window.fixture.add("a", (r) => r.id.eq("A"));
    window.fixture.add("b", (r) => r.id.eq("B"));
  });
  await pending("a");
  await pending("b");
  await page.evaluate(() => {
    window.fixture.apply(0);
    window.fixture.apply(1);
  });
  await rows("a", ["A"]);
  await rows("b", ["B"]);
  await page.evaluate(() => window.fixture.add("union", (r) => r.id.eq("A").or(r.id.eq("B"))));
  await rows("union", ["A", "B"]);
  assert.equal(await count(), 2);
  await page.evaluate(() => {
    window.fixture.remove("a");
    window.fixture.remove("b");
  });
  assert.equal(
    await page.evaluate(() => window.fixture.registrations.some((entry) => entry.unsubscribed)),
    false,
  );
  await page.evaluate(() => window.fixture.error(0));
  await page.locator("#union").filter({ hasText: "Subscription failed" }).waitFor();
  assert.equal(await page.evaluate(() => window.fixture.registrations[1].unsubscribed), true);
  await page.waitForFunction(() => window.fixture.listeners.update.size === 0);
  console.log(
    "PASS: unions retain all covering subscriptions and propagate a supplying subscription's failure.",
  );

  await reset();
  await page.evaluate(() => window.fixture.add("blue", (r) => r.color.eq("blue")));
  await pending("blue");
  await page.evaluate(() => window.fixture.apply(0));
  await rows("blue", ["A", "B"]);
  await page.evaluate(() => window.fixture.add("all"));
  await pending("all");
  assert.equal(await count(), 2);
  await page.evaluate(() => window.fixture.apply(1));
  await rows("all", ["A", "B", "C"]);
  console.log("PASS: a partial cache is never mistaken for a complete result.");

  await reset();
  await page.evaluate(() => window.fixture.add("gone"));
  await pending("gone");
  await page.evaluate(() => window.fixture.remove("gone"));
  await page.locator("#gone").waitFor({ state: "detached" });
  await page.evaluate(() => window.fixture.apply(0));
  assert.equal(await page.evaluate(() => window.fixture.registrations[0].unsubscribed), true);
  assert.equal(await page.evaluate(() => window.fixture.listeners.update.size), 0);
  console.log("PASS: disposing a pending reader unsubscribes safely when acknowledgement arrives.");

  await reset();
  await page.evaluate(() => window.fixture.add("blue", (r) => r.color.eq("blue")));
  await pending("blue");
  await page.evaluate(() => window.fixture.apply(0));
  await rows("blue", ["A", "B"]);
  await page.evaluate(() => {
    window.fixture.add("pk", (r) => r.id.eq("A"));
    window.fixture.add("duplicate", (r) => r.id.eq("A"));
  });
  await rows("pk", ["A"]);
  await rows("duplicate", ["A"]);
  assert.equal(await count(), 2, "cached PK readers still establish one shared subscription");
  assert.equal(await page.evaluate(() => window.fixture.registrations[1].active), false);
  await page.evaluate(() => window.fixture.remove("blue"));
  assert.equal(await page.evaluate(() => window.fixture.registrations[0].unsubscribed), false);
  await page.evaluate(() => window.fixture.apply(1));
  assert.equal(await page.evaluate(() => window.fixture.registrations[0].unsubscribed), true);
  await page.evaluate(() => window.fixture.update("A", "Changed after handoff"));
  await page.waitForFunction(() =>
    document.getElementById("pk").textContent.includes("Changed after handoff"),
  );
  await page.evaluate(() => {
    window.fixture.remove("pk");
    window.fixture.remove("duplicate");
  });
  await page.waitForFunction(
    () =>
      window.fixture.registrations[1].unsubscribed && window.fixture.listeners.update.size === 0,
  );
  console.log(
    "PASS: cached primary-key rows load before acknowledgement, pin their suppliers, share pending queries, hand over to their own subscription, and clean up.",
  );

  for (const unique of ["metadata", "constraint"]) {
    await reset();
    await page.evaluate(() => window.fixture.add("blue", (r) => r.color.eq("blue")));
    await pending("blue");
    await page.evaluate(() => window.fixture.apply(0));
    await rows("blue", ["A", "B"]);
    await page.evaluate(
      (unique) => window.fixture.add("unique", (r) => r.title.eq("One"), unique),
      unique,
    );
    await rows("unique", ["A"]);
    assert.equal(await count(), 2);
    assert.equal(await page.evaluate(() => window.fixture.registrations[1].active), false);
    await page.evaluate(() => {
      window.fixture.remove("blue");
      window.fixture.apply(1);
    });
    assert.equal(await page.evaluate(() => window.fixture.registrations[0].unsubscribed), true);
    await page.evaluate(() => window.fixture.update("A", "No longer matches"));
    await rows("unique", []);
  }
  console.log(
    "PASS: non-primary unique lanes work through both lane metadata and explicit constraints, including subsequent changes to the unique value.",
  );

  await reset();
  await page.evaluate(() => window.fixture.add("blue", (r) => r.color.eq("blue")));
  await pending("blue");
  await page.evaluate(() => window.fixture.apply(0));
  await rows("blue", ["A", "B"]);
  await page.evaluate(() =>
    window.fixture.add("filtered", (r) => r.id.eq("A").and(r.color.eq("red"))),
  );
  await rows("filtered", []);
  assert.equal(await page.evaluate(() => window.fixture.registrations[1].active), false);
  await page.evaluate(() => {
    window.fixture.remove("blue");
    window.fixture.apply(1);
    window.fixture.color("A", "red");
  });
  await rows("filtered", ["A"]);
  console.log(
    "PASS: a cached unique row rejected by additional conditions gives an immediate empty answer and remains subscribed for future matching changes.",
  );

  await reset();
  await page.evaluate(() => window.fixture.add("blue", (r) => r.color.eq("blue")));
  await pending("blue");
  await page.evaluate(() => window.fixture.apply(0));
  await rows("blue", ["A", "B"]);
  await page.evaluate(() => {
    window.fixture.add("union", (r) => r.id.eq("A").or(r.id.eq("B")));
    window.fixture.add("missing", (r) => r.id.eq("A").or(r.id.eq("C")));
    window.fixture.add("unbounded", (r) => r.id.eq("A").or(r.color.eq("red")));
    window.fixture.add("contradictory", (r) => r.id.eq("A").or(r.id.eq("B").and(r.id.eq("C"))));
  });
  await rows("union", ["A", "B"]);
  await rows("contradictory", ["A"]);
  await pending("missing");
  await pending("unbounded");
  await page.evaluate(() => {
    window.fixture.apply(2);
    window.fixture.apply(3);
  });
  await rows("missing", ["A", "C"]);
  await rows("unbounded", ["A", "C"]);
  console.log(
    "PASS: every possible OR branch needs a cached unique witness; missing and unbounded branches await acknowledgement.",
  );

  await reset();
  await page.evaluate(() => window.fixture.add("a", (r) => r.id.eq("A")));
  await pending("a");
  await page.evaluate(() => window.fixture.apply(0));
  await rows("a", ["A"]);
  await page.evaluate(() => window.fixture.add("nonunique", (r) => r.color.eq("blue")));
  await pending("nonunique");
  await page.evaluate(() => window.fixture.apply(1));
  await rows("nonunique", ["A", "B"]);
  console.log("PASS: seeing a nonunique match never implies a complete result.");

  for (const failing of [0, 1]) {
    await reset();
    await page.evaluate(() => window.fixture.add("blue", (r) => r.color.eq("blue")));
    await pending("blue");
    await page.evaluate(() => window.fixture.apply(0));
    await rows("blue", ["A", "B"]);
    await page.evaluate(() => window.fixture.add("pk", (r) => r.id.eq("A")));
    await rows("pk", ["A"]);
    await page.evaluate((index) => window.fixture.error(index), failing);
    await page.locator("#pk").filter({ hasText: "Subscription failed" }).waitFor();
    if (failing === 0) {
      await page.evaluate(() => window.fixture.apply(1));
      assert.equal(await page.evaluate(() => window.fixture.registrations[1].unsubscribed), true);
    }
  }
  console.log(
    "PASS: failures in a borrowed supplier or the new subscription reach already-rendered readers.",
  );

  await reset();
  await page.evaluate(() => window.fixture.add("blue", (r) => r.color.eq("blue")));
  await pending("blue");
  await page.evaluate(() => window.fixture.apply(0));
  await rows("blue", ["A", "B"]);
  await page.evaluate(() => window.fixture.add("pk", (r) => r.id.eq("A")));
  await rows("pk", ["A"]);
  await page.evaluate(() => {
    window.fixture.apply(1);
    window.fixture.error(0);
  });
  await rows("pk", ["A"]);
  await page.evaluate(() => window.fixture.update("A", "Still subscribed"));
  await page.waitForFunction(() =>
    document.getElementById("pk").textContent.includes("Still subscribed"),
  );
  console.log("PASS: once handoff completes, supplier errors no longer affect the new reader.");

  await reset();
  await page.evaluate(() => window.fixture.add("blue", (r) => r.color.eq("blue")));
  await pending("blue");
  await page.evaluate(() => window.fixture.apply(0));
  await rows("blue", ["A", "B"]);
  await page.evaluate(() => window.fixture.add("pk", (r) => r.id.eq("A")));
  await rows("pk", ["A"]);
  await page.evaluate(() => window.fixture.color("A", "red"));
  await rows("blue", ["B"]);
  await rows("pk", ["A"]);
  await page.evaluate(() => window.fixture.apply(1));
  await rows("pk", ["A"]);
  await page.waitForFunction(() =>
    document.getElementById("pk").textContent.includes('"color":"red"'),
  );
  console.log(
    "PASS: losing a cached row from the supplier during handoff preserves the complete initial snapshot until the new subscription supplies its current state.",
  );
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
