import { css } from "@csslit/core";
import { For, Show, createSignal, onCleanup, onSettled } from "solid-js";
import { Button } from "#/ui/Button.tsx";
import { Select } from "#/ui/Select.tsx";
import { Icon } from "#/ui/Icon.tsx";
import { colors, fontSize, space, radius, breakpoints } from "#/theme.ts";
import type { NetworkLab, NetworkPacket, NetworkRow } from "./core.ts";
import {
  saveNetworkSettings,
  transitDurations,
  speedVariations,
} from "./settings.ts";

// Borders (2), header (56), content padding (22), axis (8), gap (8),
// and two channel rows (32 + 4 + 32). The wrapped header adds 37px.
const minimumHeight = 164;
const wrappedMinimumHeight = 201;
const headerWrapWidth = 480;
const sizeStorageKey = "solid-kanban:network-lab:size";
const openStorageKey = "solid-kanban:network-lab:open";

function Packet(props: { packet: NetworkPacket }) {
  const position = () =>
    props.packet.direction === "in"
      ? 1 - props.packet.progress
      : props.packet.progress;
  return (
    <span
      aria-hidden="true"
      style={{
        left: `${position() * 100}%`,
        transform: `translate(${-position() * 100}%, -50%)`,
      }}
      class={[
        css`
          position: absolute;
          top: 50%;
          left: 0;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${colors.accent};
          box-shadow: 0 0 0 2px ${colors.paper};
          transform: translateY(-50%);
        `,
        props.packet.direction === "in" &&
          css`
            background: ${colors.pending};
          `,
      ]}
    />
  );
}

function TrafficRow(props: {
  row: NetworkRow;
  packets: readonly NetworkPacket[];
}) {
  return (
    <div
      class={[
        css`
          display: grid;
          grid-template-columns: minmax(0, min(344px, 40%)) minmax(0, 1fr);
          align-items: center;
          gap: ${space.md}px;
          padding: ${space.sm - 1}px;
          border: 1px solid transparent;
          border-radius: ${radius.small}px;
          background: ${colors.canvas};
        `,
        props.row.state === "error" &&
          css`
            border-color: ${colors.dangerBorder};
            background: ${colors.dangerSurface};
          `,
      ]}
    >
      <span
        title={props.row.label}
        class={css`
          display: flex;
          align-items: center;
          gap: ${space.sm}px;
          min-width: 0;
          font-size: ${fontSize.body}px;
          color: ${colors.ink};
        `}
      >
        <span
          class={[
            css`
              flex: none;
              padding: ${space.xs}px;
              border-radius: ${radius.small}px;
              background: ${colors.blueSurface};
              color: ${colors.blueText};
              font-size: ${fontSize.caption}px;
              font-weight: 600;
              white-space: nowrap;
            `,
            props.row.direction === "in" &&
              css`
                background: ${colors.goldSurface};
                color: ${colors.goldText};
              `,
          ]}
        >
          {props.row.kind === "websocket"
            ? props.row.direction === "out"
              ? "WS →"
              : "WS ←"
            : "HTTP"}
        </span>
        <span
          class={css`
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: ${colors.muted};
          `}
        >
          {props.row.label}
        </span>
      </span>
      <div
        class={css`
          position: relative;
          min-width: 0;
          height: 16px;
          border-left: 1px solid ${colors.borderHover};
          border-right: 1px solid ${colors.borderHover};
          background: repeating-linear-gradient(
            90deg,
            transparent 0,
            transparent calc(25% - 1px),
            ${colors.borderSubtle} calc(25% - 1px),
            ${colors.borderSubtle} 25%
          );

          &::before {
            content: "";
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            height: 2px;
            border-radius: 1px;
            background: ${colors.border};
            transform: translateY(-50%);
          }
        `}
      >
        <For
          each={props.packets.filter((packet) => packet.rowId === props.row.id)}
          keyed={(packet) => packet.id}
        >
          {(packet) => <Packet packet={packet()} />}
        </For>
      </div>
    </div>
  );
}

export function NetworkPanel(props: { lab?: NetworkLab }) {
  let dialog!: HTMLDialogElement;
  let disposed = false;
  onCleanup(() => {
    disposed = true;
    dialog?.hidePopover();
  });
  const [open, setOpen] = createSignal(
    () => {
      try {
        return localStorage.getItem(openStorageKey) === "true";
      } catch {
        return false;
      }
    },
    { ssrSource: "client" },
  );
  const [size, setSize] = createSignal<{ height: number; width?: number }>(
    () => {
      try {
        const saved = JSON.parse(
          localStorage.getItem(sizeStorageKey) ?? "null",
        );
        return {
          height:
            Number.isFinite(saved?.height) && saved.height > 0
              ? saved.height
              : 240,
          width:
            Number.isFinite(saved?.width) && saved.width > 0
              ? saved.width
              : undefined,
        };
      } catch {
        return { height: 240 };
      }
    },
    { ssrSource: "client" },
  );
  let resizeStart:
    | { x: number; y: number; height: number; width: number; corner: boolean }
    | undefined;
  const startResize = (
    event: PointerEvent & { currentTarget: HTMLElement },
    corner: boolean,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const bounds = event.currentTarget.parentElement!.getBoundingClientRect();
    resizeStart = {
      x: event.clientX,
      y: event.clientY,
      height: bounds.height,
      width: bounds.width,
      corner,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const resize = (event: PointerEvent) => {
    if (!resizeStart) return;
    const margin = window.innerWidth <= breakpoints.phone ? space.sm : space.lg;
    const availableHeight = window.innerHeight - 2 * margin;
    const availableWidth = window.innerWidth - 2 * margin;
    setSize({
      height: Math.max(
        Math.min(minimumHeight, availableHeight),
        Math.min(
          availableHeight,
          resizeStart.height + resizeStart.y - event.clientY,
        ),
      ),
      width: resizeStart.corner
        ? Math.max(
            Math.min(360, availableWidth),
            Math.min(
              availableWidth,
              resizeStart.width + resizeStart.x - event.clientX,
            ),
          )
        : size().width,
    });
  };
  const endResize = () => {
    if (!resizeStart) return;
    resizeStart = undefined;
    try {
      localStorage.setItem(sizeStorageKey, JSON.stringify(size()));
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  };
  const [saveFailed, setSaveFailed] = createSignal(false);
  const [snapshot, setSnapshot] = createSignal(() => props.lab!.snapshot(), {
    ssrSource: "client",
  });
  if (props.lab) {
    onCleanup(props.lab.subscribe(() => setSnapshot(props.lab!.snapshot())));
  }

  const configure = (next: { delayMs?: number; jitter?: number }) => {
    if (!props.lab) return;
    props.lab.configure(next);
    const { delayMs, jitter } = props.lab.snapshot();
    setSaveFailed(!saveNetworkSettings({ delayMs, jitter }));
  };

  const toggle = () => {
    if (props.lab) setSnapshot(props.lab.snapshot());
    const next = !open();
    setOpen(next);
    try {
      localStorage.setItem(openStorageKey, String(next));
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  };
  return (
    <dialog
      popover="manual"
      ref={(element) => {
        dialog = element;
        // Present nonmodally in the top layer so the board stays interactive.
        onSettled(() => {
          if (!disposed && element.isConnected) element.showPopover();
        });
      }}
      aria-label="Network lab"
      style={
        open()
          ? {
              height: `${size().height}px`,
              width:
                size().width === undefined ? undefined : `${size().width}px`,
            }
          : undefined
      }
      class={[
        css`
          position: fixed;
          display: flex;
          inset: auto;
          margin: 0;
          padding: 0;
          width: auto;
          max-height: none;
          color: inherit;
          bottom: ${space.lg}px;
          right: ${space.lg}px;
          min-width: 0;
          max-width: calc(100% - ${2 * space.lg}px);
          background: ${colors.paper};
          border: 1px solid ${colors.border};
          border-radius: 999px;
          box-shadow: 0 8px 32px ${colors.shadowDialog};
          overflow: hidden;

          @media (max-width: ${breakpoints.phone}px) {
            bottom: ${space.sm}px;
            right: ${space.sm}px;
            max-width: calc(100% - ${2 * space.sm}px);
          }
        `,
        open() &&
          css`
            left: ${space.lg}px;
            display: flex;
            flex-direction: column;
            container-type: inline-size;
            --network-lab-min-height: ${minimumHeight}px;
            min-height: min(
              var(--network-lab-min-height),
              calc(100% - ${2 * space.lg}px)
            );
            max-height: calc(100% - ${2 * space.lg}px);
            border-radius: ${space.lg}px;

            @media (max-width: ${headerWrapWidth + 2 + 2 * space.lg}px) {
              --network-lab-min-height: ${wrappedMinimumHeight}px;
            }
            @media (max-width: ${breakpoints.phone}px) {
              left: ${space.sm}px;
              min-height: min(
                var(--network-lab-min-height),
                calc(100% - ${2 * space.sm}px)
              );
              max-height: calc(100% - ${2 * space.sm}px);
            }
          `,
        open() &&
          size().width !== undefined &&
          size().width! <= headerWrapWidth + 2 &&
          css`
            --network-lab-min-height: ${wrappedMinimumHeight}px;
          `,
        open() &&
          size().width !== undefined &&
          css`
            left: auto;
            @media (max-width: ${breakpoints.phone}px) {
              left: auto;
            }
          `,
      ]}
    >
      <Show
        when={open()}
        fallback={
          <Button
            variant="ghost"
            pad="md"
            aria-expanded="false"
            onClick={toggle}
          >
            <Icon name="activity" />
            Network lab
            <span
              class={css`
                color: ${colors.accent};
                font-size: ${fontSize.caption}px;
              `}
            >
              {snapshot().delayMs === 0
                ? "Real speed"
                : `${snapshot().delayMs / 1000}s`}
            </span>
          </Button>
        }
      >
        <div
          role="separator"
          aria-label="Resize network lab height"
          aria-orientation="horizontal"
          onPointerDown={(event) => startResize(event, false)}
          onPointerMove={resize}
          onPointerUp={endResize}
          onLostPointerCapture={endResize}
          class={css`
            position: absolute;
            z-index: 1;
            top: 0;
            left: ${space.xl}px;
            right: ${space.sm}px;
            height: ${space.md}px;
            touch-action: none;
            cursor: ns-resize;

            &::before {
              content: "";
              position: absolute;
              top: ${space.xs}px;
              left: 50%;
              width: 32px;
              height: 3px;
              border-radius: 2px;
              background: ${colors.borderHover};
              transform: translateX(-50%);
            }
            &:hover::before {
              background: ${colors.accent};
            }
          `}
        />
        <div
          role="separator"
          aria-label="Resize network lab"
          onPointerDown={(event) => startResize(event, true)}
          onPointerMove={resize}
          onPointerUp={endResize}
          onLostPointerCapture={endResize}
          class={css`
            position: absolute;
            z-index: 2;
            top: 0;
            left: 0;
            width: ${space.xl}px;
            height: ${space.xl}px;
            cursor: nwse-resize;
            touch-action: none;

            &::before {
              content: "";
              position: absolute;
              top: ${space.sm}px;
              left: ${space.sm}px;
              width: ${space.sm}px;
              height: ${space.sm}px;
              border-top: 2px solid ${colors.borderHover};
              border-left: 2px solid ${colors.borderHover};
              border-radius: 3px 0 0;
            }
            &:hover::before {
              border-color: ${colors.accent};
            }
          `}
        />
        <header
          class={css`
            display: grid;
            flex: none;
            align-items: center;
            grid-template-columns: minmax(0, 1fr) auto auto;
            gap: ${space.md}px;
            padding: ${space.md - 1}px;
            border-bottom: 1px solid ${colors.borderSubtle};
            background: ${colors.canvas};

            @container (max-width: ${headerWrapWidth}px) {
              grid-template-columns: minmax(0, 1fr) auto;
            }
          `}
        >
          <div
            class={css`
              grid-column: 1;
              grid-row: 1;
              display: flex;
              align-items: center;
              gap: ${space.md}px;
              min-width: 0;
            `}
          >
            <span
              class={css`
                display: grid;
                place-items: center;
                flex: none;
                padding: ${space.xs}px;
                border-radius: ${radius.small}px;
                color: ${colors.accent};
                background: ${colors.soft};
              `}
            >
              <Icon name="activity" />
            </span>
            <div
              class={css`
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: ${space.sm}px;
                min-width: 0;
              `}
            >
              <h2
                class={css`
                  font-size: ${fontSize.control}px;
                  font-weight: 650;
                `}
              >
                Network lab
              </h2>
              <span
                class={css`
                  font-size: ${fontSize.caption}px;
                  color: ${colors.muted};
                `}
              >
                {snapshot().packets.length} in flight
              </span>
            </div>
          </div>
          <div
            role="group"
            aria-label="Delay settings"
            class={css`
              grid-column: 2;
              grid-row: 1;
              display: flex;
              align-items: center;
              min-width: 0;
              gap: ${space.sm}px;

              @container (max-width: ${headerWrapWidth}px) {
                grid-column: 1 / -1;
                grid-row: 2;
                display: grid;
                grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr);
              }
            `}
          >
            <span
              class={css`
                font-size: ${fontSize.caption}px;
                color: ${colors.muted};
              `}
            >
              Delay
            </span>
            <Select
              fitContent
              aria-label="One-way delay"
              value={snapshot().delayMs}
              onChange={(event) =>
                configure({ delayMs: Number(event.currentTarget.value) })
              }
            >
              <For each={transitDurations}>
                {(duration) => (
                  <option value={duration}>
                    {duration === 0
                      ? "Real speed"
                      : duration < 1000
                        ? `${duration} ms`
                        : `${duration / 1000} ${duration === 1000 ? "second" : "seconds"}`}
                  </option>
                )}
              </For>
            </Select>
            <Select
              fitContent
              aria-label="Speed variation"
              value={snapshot().jitter}
              onChange={(event) =>
                configure({ jitter: Number(event.currentTarget.value) })
              }
            >
              <For each={speedVariations}>
                {(variation) => (
                  <option value={variation}>
                    {variation === 0 ? "Consistent" : `±${variation * 100}%`}
                  </option>
                )}
              </For>
            </Select>
          </div>
          <div
            class={css`
              grid-column: 3;
              grid-row: 1;
              display: flex;

              @container (max-width: ${headerWrapWidth}px) {
                grid-column: 2;
              }
            `}
          >
            <Button
              variant="ghost"
              pad="sm"
              iconOnly
              aria-label="Close Network lab"
              aria-expanded="true"
              title="Minimize network lab"
              onClick={toggle}
            >
              <Icon name="down" />
            </Button>
          </div>
        </header>
        <Show when={saveFailed()}>
          <p
            class={css`
              padding: ${space.md}px;
              color: ${colors.danger};
              font-size: ${fontSize.body}px;
            `}
          >
            Settings could not be saved in this browser.
          </p>
        </Show>
        <div
          class={css`
            display: flex;
            flex: 1;
            flex-direction: column;
            min-height: 0;
            min-width: 0;
            padding: ${space.md - 1}px;
            gap: ${space.sm}px;
          `}
        >
          <div
            class={css`
              display: grid;
              flex: none;
              grid-template-columns: minmax(0, min(344px, 40%)) minmax(0, 1fr);
              gap: ${space.md}px;
              padding: 0 ${space.sm}px;
              color: ${colors.muted};
              font-size: ${fontSize.caption}px;
            `}
          >
            <span>Connection</span>
            <span
              class={css`
                display: flex;
                justify-content: space-between;
                gap: ${space.sm}px;
              `}
            >
              <span>Client</span>
              <span>Server</span>
            </span>
          </div>
          <div
            class={css`
              display: flex;
              flex-direction: column;
              min-height: 0;
              min-width: 0;
              overflow: auto;
              flex: 1;
              gap: ${space.xs}px;
            `}
          >
            <For each={snapshot().rows}>
              {(row) => <TrafficRow row={row} packets={snapshot().packets} />}
            </For>
            <Show when={snapshot().rows.length === 0}>
              <div
                class={css`
                  display: flex;
                  flex: 1;
                  align-items: center;
                  justify-content: center;
                  gap: ${space.sm}px;
                  padding: ${space.lg}px;
                  border: 1px dashed ${colors.border};
                  border-radius: ${radius.card}px;
                  color: ${colors.muted};
                  font-size: ${fontSize.body}px;
                `}
              >
                <Icon name="activity" />
                No network activity
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </dialog>
  );
}
