import type * as db from "#/module_bindings/types.ts";

import { compareKeys, keyBetween, positionKey } from "#/primitives/ordered-key.ts";

export const duplicateCardError = "This card already exists.";

export const labels = ["", "Design", "Engineering", "Research", "Content"] as const;
export const priorities = ["Normal", "High", "Urgent"] as const;

export function cardPosition(card: Pick<db.Card, "id" | "orderKey">) {
  return positionKey(card.orderKey, card.id);
}

export function compareCards(a: db.Card, b: db.Card) {
  return compareKeys(cardPosition(a), cardPosition(b));
}

export function placementKey(
  cards: readonly db.Card[],
  id: string,
  laneId: string,
  beforeId: string,
) {
  const target = cards
    .filter((card) => !card.archived && card.laneId === laneId && card.id !== id)
    .sort(compareCards);
  const index = beforeId ? target.findIndex((card) => card.id === beforeId) : target.length;
  if (index < 0) throw new Error("The destination changed. Try moving the card again.");
  return keyBetween(
    index ? cardPosition(target[index - 1]) : undefined,
    index < target.length ? cardPosition(target[index]) : undefined,
  );
}
