import { render } from "@solidjs/web";
import { Loading } from "solid-js";
import { createNetworkLab, type NetworkLab } from "../../src/network-lab/core";
import { NetworkPanel } from "../../src/network-lab/NetworkPanel";
import "../../src/global-style";

declare global {
  interface Window {
    networkLab: NetworkLab;
    networkSocket: WebSocket;
    networkReceived: string[];
    networkRandom: number;
    waitForPackets: (count: number, direction: "in" | "out") => Promise<void>;
  }
}

window.networkRandom = 0.5;
Math.random = () => window.networkRandom;
const lab = createNetworkLab({
  interceptWebSocket: (url) => url.pathname === "/network-lab-check",
  initialSettings: { delayMs: 2000, jitter: 1 },
});
window.networkLab = lab;
window.waitForPackets = (count, direction) =>
  new Promise((resolve) => {
    const ready = () =>
      lab.snapshot().packets.filter((packet) => packet.direction === direction)
        .length === count;
    if (ready()) return resolve();
    const stop = lab.subscribe(() => {
      if (ready()) {
        stop();
        resolve();
      }
    });
  });
window.networkReceived = [];
window.networkSocket = new WebSocket("ws://127.0.0.1:3002/network-lab-check");
window.networkSocket.addEventListener("message", (event) =>
  window.networkReceived.push(event.data),
);
render(
  () => (
    <Loading fallback={null}>
      <NetworkPanel lab={lab} />
    </Loading>
  ),
  document.getElementById("root")!,
);
