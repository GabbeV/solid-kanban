import type { Card } from "../module_bindings/types";

export const labels = [
  "",
  "Design",
  "Engineering",
  "Research",
  "Content",
] as const;
export const priorities = ["Normal", "High", "Urgent"] as const;

export function compareKeys(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Preserve rows predating the additive order-key migration without rewriting
// anyone's board. Once moved, a card has its own permanent fractional key.
export function cardKey(card: Pick<Card, "orderKey" | "position" | "id">) {
  return (
    card.orderKey ||
    (BigInt(card.position) + 1n).toString(16).padStart(16, "0") +
      Array.from(card.id, (char) =>
        char.codePointAt(0)!.toString(16).padStart(6, "0"),
      ).join("") +
      "8"
  );
}

export function compareCards(a: Card, b: Card) {
  return compareKeys(cardKey(a), cardKey(b)) || compareKeys(a.id, b.id);
}

export function validOrderKey(key: string) {
  return /^[0-9a-f]*[1-9a-f]$/.test(key);
}

// Exact hexadecimal fractions in (0, 1), ordered as strings. Find a prefix
// strictly inside the gap, then append a unique ID inside that interval.
// Concurrent inserts stay distinct and can themselves have cards inserted
// between them. There is no float precision limit or list-wide renumbering.
export function keyBetween(
  left: string | undefined,
  right: string | undefined,
  nonce: string,
) {
  if (
    (left !== undefined && !validOrderKey(left)) ||
    (right !== undefined && !validOrderKey(right)) ||
    (left !== undefined && right !== undefined && left >= right) ||
    !/^[0-9a-f]{32}$/.test(nonce)
  )
    throw new Error("Invalid card order bounds.");
  let low = 0n,
    high = 0n,
    scale = 1n;
  for (let digits = 1; ; digits++) {
    scale *= 16n;
    low = low * 16n + BigInt(parseInt(left?.[digits - 1] ?? "0", 16));
    high =
      right === undefined
        ? scale
        : high * 16n + BigInt(parseInt(right[digits - 1] ?? "0", 16));
    if (high - low > 1n)
      return (
        ((low + high) / 2n).toString(16).padStart(digits, "0") + nonce + "8"
      );
  }
}

export function placementKey(
  cards: readonly Card[],
  id: string,
  columnId: string,
  beforeId: string,
  nonce: string,
) {
  const target = cards
    .filter(
      (card) => !card.archived && card.columnId === columnId && card.id !== id,
    )
    .sort(compareCards);
  const index = beforeId
    ? target.findIndex((card) => card.id === beforeId)
    : target.length;
  if (index < 0)
    throw new Error("The destination changed. Try moving the card again.");
  return keyBetween(
    index ? cardKey(target[index - 1]) : undefined,
    index < target.length ? cardKey(target[index]) : undefined,
    nonce,
  );
}
