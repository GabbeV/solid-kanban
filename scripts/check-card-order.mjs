import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cardPosition,
  compareCards,
  placementKey,
} from "../src/board/cards.ts";
import {
  keyBetween,
  orderDigits,
  positionKey,
  validOrderKey,
} from "../src/primitives/ordered-key.ts";

const uuid = (text) => {
  const hex = createHash("sha256").update(text).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const card = (id, orderKey, laneId = "lane") => ({
  id,
  orderKey,
  laneId,
  boardId: "board",
  title: id,
  description: "",
  label: "",
  priority: "Normal",
  assignee: "",
  dueDate: "",
  archived: false,
});

assert.equal(orderDigits.length, 64);
assert.equal([...orderDigits].sort().join(""), orderDigits);
assert.equal(new Set(orderDigits).size, 64);
for (const key of ["0", "V", "z", "--0", "V-0", "00000000000000018"])
  assert(validOrderKey(key), key);
for (const key of ["", "-", "V-", "a/b", "+", "=", "é", "0\n"])
  assert(!validOrderKey(key), key);
for (const [left, right] of [
  ["-", "V"],
  ["V", "V"],
  ["z", "V"],
])
  assert.throws(() => keyBetween(left, right), /Invalid order bounds/);

const ids = [
  "00000000-0000-0000-0000-000000000000",
  "ffffffff-ffff-ffff-ffff-ffffffffffff",
  uuid("X"),
  "welcome-0",
  "a",
  "ba",
  "",
  "\0",
  "😀",
  "\ud800",
  "A".repeat(80),
];
const suffixes = ids.map((id) => positionKey("V", id).slice(1));
assert.equal(suffixes[0].length, 23, "UUID suffix has a fixed width");
assert.equal(new Set(suffixes).size, ids.length);
for (const suffix of suffixes) assert(validOrderKey(suffix));
for (let i = 0; i < ids.length; i++)
  for (let j = 0; j < ids.length; j++)
    if (i !== j)
      assert(!suffixes[i].endsWith(suffixes[j]), "ID suffixes cannot alias");

// Two independent requests choose the same prefix. A later request can still
// insert strictly between them, without changing either card's prefix.
const a = card(ids[0], keyBetween(undefined, undefined));
const b = card(ids[1], keyBetween(undefined, undefined));
const x = card(ids[2], placementKey([a, b], ids[2], "lane", b.id));
assert.equal(a.orderKey, b.orderKey);
assert.deepEqual(
  [b, x, a].sort(compareCards).map((row) => row.id),
  [a.id, x.id, b.id],
);
assert(a.orderKey < x.orderKey, "Sorting raw prefixes would put X after B");
assert.equal(a.orderKey, "V");
assert.equal(b.orderKey, "V");
const y = card(uuid("Y"), placementKey([a, x, b], uuid("Y"), "lane", x.id));
assert(compareCards(a, y) < 0 && compareCards(y, x) < 0);
assert.equal(
  placementKey(
    [a, b, card(uuid("archived"), "0", "lane")].map((row) =>
      row.id === a.id || row.id === b.id ? row : { ...row, archived: true },
    ),
    a.id,
    "lane",
    b.id,
  ),
  keyBetween(undefined, cardPosition(b)),
  "Placement excludes the moved card and archived cards",
);
assert.throws(
  () => placementKey([a], x.id, "lane", "missing"),
  /destination changed/,
);

// Every generated prefix must leave room for every possible ID suffix, even
// when one complete position is a prefix of the other.
const prefixes = ["0", "V", "VV", "V0", "V-0", "z", "z-0", "--0"];
const positions = prefixes
  .flatMap((key) => ids.map((id) => positionKey(key, id)))
  .sort();
assert.equal(new Set(positions).size, positions.length);
let intervals = 0;
for (let i = 0; i < positions.length; i++) {
  for (let j = i + 1; j < positions.length; j++) {
    const key = keyBetween(positions[i], positions[j]);
    assert(validOrderKey(key));
    for (const id of ids) {
      const position = positionKey(key, id);
      assert(positions[i] < position && position < positions[j]);
      intervals++;
    }
  }
  for (const id of ids) {
    assert(positionKey(keyBetween(undefined, positions[i]), id) < positions[i]);
    assert(positionKey(keyBetween(positions[i], undefined), id) > positions[i]);
  }
}
let right = cardPosition(b);
for (let i = 0; i < 1000; i++) {
  const next = card(uuid(`tight-${i}`), keyBetween(cardPosition(a), right));
  assert(cardPosition(a) < cardPosition(next) && cardPosition(next) < right);
  right = cardPosition(next);
}

// Simulate three clients with ordered outgoing requests and ordered incoming
// snapshots. Each can have six pending moves, including repeated moves of the
// same card. Servers reject 10% of requests; other requests keep the order they
// chose relative to any observed card that hasn't itself moved on the server.
let randomState = 0x1631aa;
const random = (n) => {
  randomState ^= randomState << 13;
  randomState ^= randomState >>> 17;
  randomState ^= randomState << 5;
  return (randomState >>> 0) % n;
};
let operations = 0;
let failures = 0;
let checks = 0;
for (let run = 0; run < 100; run++) {
  let server = Array.from({ length: 8 }, (_, i) => ({
    ...card(uuid(`card-${i}`), orderDigits[(i + 1) * 7]),
    version: 0,
  }));
  const clients = Array.from({ length: 3 }, () => ({
    source: server,
    pending: [],
    replies: [],
  }));
  let serial = 0;
  let issued = 0;
  const place = (rows, request) =>
    rows
      .map((row) =>
        row.id === request.id
          ? { ...row, orderKey: request.orderKey, version: request.serial }
          : row,
      )
      .sort(compareCards);
  const view = (client) => client.pending.reduce(place, client.source);
  const issue = (client) => {
    const rows = view(client);
    const id = rows[random(rows.length)].id;
    const others = rows.filter((row) => row.id !== id);
    const index = random(others.length + 1);
    const left = index ? cardPosition(others[index - 1]) : undefined;
    const right =
      index < others.length ? cardPosition(others[index]) : undefined;
    client.pending.push({
      id,
      left,
      right,
      serial: ++serial,
      processed: false,
      orderKey: placementKey(rows, id, "lane", others[index]?.id ?? ""),
      witnesses: others.map((row, i) => ({ ...row, before: i < index })),
    });
    issued++;
    operations++;
  };
  const process = (client) => {
    const request = client.pending.find((request) => !request.processed);
    if (!request) return;
    request.processed = true;
    if (random(10) === 0) failures++;
    else {
      const stable = request.witnesses.filter((w) =>
        server.some((row) => row.id === w.id && row.version === w.version),
      );
      server = place(server, request);
      const index = server.findIndex((row) => row.id === request.id);
      const position = cardPosition(server[index]);
      if (request.left !== undefined) assert(request.left < position);
      if (request.right !== undefined) assert(position < request.right);
      for (const witness of stable) {
        assert.equal(
          server.findIndex((row) => row.id === witness.id) < index,
          witness.before,
        );
        checks++;
      }
    }
    for (const other of clients)
      other.replies.push({
        rows: server,
        ack: other === client ? request.serial : undefined,
      });
  };
  const deliver = (client) => {
    const reply = client.replies.shift();
    if (!reply) return;
    client.source = reply.rows;
    if (reply.ack !== undefined)
      client.pending = client.pending.filter(
        (request) => request.serial !== reply.ack,
      );
    const rows = view(client);
    for (let i = 1; i < rows.length; i++)
      assert(compareCards(rows[i - 1], rows[i]) < 0);
  };
  for (let step = 0; step < 3000; step++) {
    const client = clients[random(clients.length)];
    const choice = random(4);
    if (choice < 2 && issued < 300 && client.pending.length < 6) issue(client);
    else if (choice === 2) process(client);
    else deliver(client);
  }
  while (
    clients.some((client) => client.pending.length || client.replies.length)
  )
    for (const client of clients) {
      process(client);
      deliver(client);
    }
  for (const client of clients) assert.deepEqual(view(client), server);
}
console.log(
  `PASS ordered base-64: ${intervals} suffix-safe intervals, 1,000 tight-gap insertions, ${operations} concurrent moves, ${failures} rejected requests, ${checks} stable-card order checks.`,
);
