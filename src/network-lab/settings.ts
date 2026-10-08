import type { NetworkSettings } from "./core.ts";

const key = "solid-kanban:network-lab";
export const delayOptions = [
  0, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 20_000, 30_000, 60_000,
];
export const speedVariations = [0, 0.05, 0.1, 0.25, 0.5, 0.75, 1];
export const faultRates = [
  0, 0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1,
];

export function readNetworkSettings(): NetworkSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null");
    return {
      delayMs: delayOptions.includes(saved?.delayMs) ? saved.delayMs : 0,
      jitter: speedVariations.includes(saved?.jitter) ? saved.jitter : 0,
      faultRate: faultRates.includes(saved?.faultRate) ? saved.faultRate : 0,
    };
  } catch {
    return { delayMs: 0, jitter: 0, faultRate: 0 };
  }
}

export function saveNetworkSettings(settings: NetworkSettings) {
  try {
    localStorage.setItem(key, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
