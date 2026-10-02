import {
  WebSocketInterceptor,
  type WebSocketData,
} from "@mswjs/interceptors/WebSocket";

export type NetworkDirection = "out" | "in";
export type NetworkRow = {
  id: number;
  kind: "http" | "websocket";
  direction?: NetworkDirection;
  label: string;
  state: "open" | "done" | "error";
};
export type NetworkPacket = {
  id: number;
  rowId: number;
  direction: NetworkDirection;
  progress: number;
};
export type NetworkSettings = { delayMs: number; jitter: number };
export type NetworkSnapshot = {
  rows: readonly NetworkRow[];
  packets: readonly NetworkPacket[];
} & NetworkSettings;

type Listener = () => void;
type Channel = {
  distance: number;
  speed: number;
  targetSpeed: number;
  updatedAt: number;
  nextChangeAt: number;
};
type Journey = {
  packet: NetworkPacket;
  channel: Channel;
  startDistance: number;
  resolve: () => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
  abort: () => void;
};

function snapshotFrame(data: WebSocketData): WebSocketData {
  // WebSocket.send snapshots binary data immediately. The SDK reuses its
  // Uint8Array writer, so queued frames must own their bytes before we wait.
  if (data instanceof ArrayBuffer) return data.slice(0);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(
      data.buffer,
      data.byteOffset,
      data.byteLength,
    ).slice();
  }
  return data;
}

/** Browser transport instrumentation. It has no dependency on Solid or the app UI. */
export function createNetworkLab(options: {
  interceptWebSocket: (url: URL) => boolean;
  initialSettings?: NetworkSettings;
}) {
  let delayMs = options.initialSettings?.delayMs ?? 0;
  let jitter = options.initialSettings?.jitter ?? 0;
  let nextId = 0;
  let rows: NetworkRow[] = [];
  let packets: NetworkPacket[] = [];
  let journeys: Journey[] = [];
  let timer: number | undefined;
  const listeners = new Set<Listener>();
  const nativeFetch = globalThis.fetch;
  const interceptor = new WebSocketInterceptor();

  const notify = () => listeners.forEach((listener) => listener());
  const addRow = (row: Omit<NetworkRow, "id">) => {
    const id = ++nextId;
    rows = [...rows, { ...row, id }];
    notify();
    return id;
  };
  const finishRow = (id: number, state: "done" | "error") => {
    rows = rows.map((row) => (row.id === id ? { ...row, state } : row));
    notify();
    window.setTimeout(() => {
      rows = rows.filter((row) => row.id !== id);
      notify();
    }, 1200);
  };

  const sampleSpeed = () => 1 + (Math.random() * 2 - 1) * jitter;
  const createChannel = (): Channel => {
    const now = performance.now();
    const speed = jitter === 0 ? 1 : sampleSpeed();
    return {
      distance: 0,
      speed,
      targetSpeed: speed,
      updatedAt: now,
      nextChangeAt: now + 1000,
    };
  };

  const publishPackets = () => {
    packets = journeys.map((journey) => journey.packet);
    notify();
  };

  const advance = (now: number) => {
    for (const channel of new Set(journeys.map((journey) => journey.channel))) {
      // Integrate a smoothly changing speed on a monotonic clock. Every message
      // in this direction covers the same distance, so none can overtake.
      // Splitting at target changes also accounts for background timer throttling.
      while (channel.updatedAt < now) {
        const end = Math.min(now, channel.nextChangeAt);
        const elapsed = end - channel.updatedAt;
        const decay = Math.exp(-elapsed / 400);
        if (delayMs > 0) {
          channel.distance +=
            (channel.targetSpeed * elapsed +
              (channel.speed - channel.targetSpeed) * 400 * (1 - decay)) /
            delayMs;
        }
        channel.speed =
          channel.targetSpeed + (channel.speed - channel.targetSpeed) * decay;
        channel.updatedAt = end;
        if (end === channel.nextChangeAt) {
          channel.targetSpeed = jitter === 0 ? 1 : sampleSpeed();
          channel.nextChangeAt += 1000;
        }
      }
    }
    const arrived: Journey[] = [];
    journeys = journeys.filter((journey) => {
      const progress =
        delayMs === 0
          ? 1
          : Math.min(1, journey.channel.distance - journey.startDistance);
      journey.packet = { ...journey.packet, progress };
      if (progress < 1) return true;
      journey.signal?.removeEventListener("abort", journey.abort);
      arrived.push(journey);
      return false;
    });
    // Publish the exact progress used for delivery, rather than animating a
    // separate predicted arrival time. Resolve in insertion order for FIFO.
    publishPackets();
    for (const journey of arrived) journey.resolve();
  };

  const schedule = () => {
    if (timer !== undefined || journeys.length === 0) return;
    // Keep transport delivery running when the panel is closed or the page is
    // hidden. requestAnimationFrame would pause it in a background tab.
    timer = window.setTimeout(() => {
      timer = undefined;
      advance(performance.now());
      schedule();
    }, 16);
  };

  const travel = (
    rowId: number,
    direction: NetworkDirection,
    channel: Channel,
    signal?: AbortSignal,
  ) => {
    if (signal?.aborted) return Promise.reject(signal.reason);
    const now = performance.now();
    advance(now);
    // An idle direction has no backlog; start with fresh network conditions.
    if (!journeys.some((journey) => journey.channel === channel))
      Object.assign(channel, createChannel());
    return new Promise<void>((resolve, reject) => {
      const journey: Journey = {
        packet: { id: ++nextId, rowId, direction, progress: 0 },
        channel,
        startDistance: channel.distance,
        resolve,
        reject,
        signal,
        abort: () => {
          journeys = journeys.filter((pending) => pending !== journey);
          signal?.removeEventListener("abort", journey.abort);
          publishPackets();
          reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
        },
      };
      journeys.push(journey);
      signal?.addEventListener("abort", journey.abort, { once: true });
      if (delayMs === 0) advance(now);
      else {
        publishPackets();
        schedule();
      }
    });
  };

  const fetchWithDelay: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const rowId = addRow({
      kind: "http",
      label: `${request.method} ${new URL(request.url).pathname}`,
      state: "open",
    });
    const outbound = createChannel();
    const inbound = createChannel();
    try {
      await travel(rowId, "out", outbound, request.signal);
      const response = await nativeFetch(request);
      await travel(rowId, "in", inbound, request.signal);
      finishRow(rowId, "done");
      return response;
    } catch (error) {
      finishRow(rowId, "error");
      throw error;
    }
  };

  interceptor.on("connection", ({ client, server }) => {
    if (!options.interceptWebSocket(client.url)) {
      server.connect();
      return;
    }

    const label = `${client.url.host}${client.url.pathname}`;
    const outgoingId = addRow({
      kind: "websocket",
      direction: "out",
      label,
      state: "open",
    });
    const incomingId = addRow({
      kind: "websocket",
      direction: "in",
      label,
      state: "open",
    });
    const outbound = createChannel();
    const inbound = createChannel();
    let closed = false;

    client.addEventListener("message", (event) => {
      const frame = snapshotFrame(event.data);
      event.preventDefault();
      void travel(outgoingId, "out", outbound).then(
        () => {
          if (!closed && server.readyState === WebSocket.OPEN)
            server.send(frame);
        },
        () => {}, // Disposing the lab cancels queued traffic.
      );
    });
    server.addEventListener("message", (event) => {
      const frame = snapshotFrame(event.data);
      event.preventDefault();
      void travel(incomingId, "in", inbound).then(
        () => {
          if (!closed) client.send(frame);
        },
        () => {}, // Disposing the lab cancels queued traffic.
      );
    });
    const close = () => {
      if (closed) return;
      closed = true;
      finishRow(outgoingId, "done");
      finishRow(incomingId, "done");
    };
    client.addEventListener("close", close);
    server.addEventListener("close", close);
    server.connect();
  });

  globalThis.fetch = fetchWithDelay;
  interceptor.apply();

  return {
    snapshot: (): NetworkSnapshot => ({ rows, packets, delayMs, jitter }),
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    configure(next: { delayMs?: number; jitter?: number }) {
      const now = performance.now();
      advance(now);
      if (next.delayMs !== undefined) delayMs = next.delayMs;
      if (next.jitter !== undefined) {
        jitter = next.jitter;
        for (const channel of new Set(
          journeys.map((journey) => journey.channel),
        )) {
          channel.targetSpeed = jitter === 0 ? 1 : sampleSpeed();
          if (jitter === 0) channel.speed = 1;
          channel.nextChangeAt = now + 1000;
        }
      }
      advance(now);
      schedule();
    },
    dispose() {
      window.clearTimeout(timer);
      timer = undefined;
      const pending = journeys;
      journeys = [];
      for (const journey of pending) {
        journey.signal?.removeEventListener("abort", journey.abort);
        journey.reject(new DOMException("Network lab disposed", "AbortError"));
      }
      publishPackets();
      globalThis.fetch = nativeFetch;
      interceptor.dispose();
    },
  };
}

export type NetworkLab = ReturnType<typeof createNetworkLab>;
