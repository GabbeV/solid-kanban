import type { NetworkLab, NetworkSettings } from "#/network-lab/core.ts";

import { css } from "@csslit/core";
import { Show, createSignal, onCleanup, onSettled } from "solid-js";

import { NetworkControls } from "#/network-lab/NetworkControls.tsx";
import { NetworkTimeline } from "#/network-lab/NetworkTimeline.tsx";
import { saveNetworkSettings } from "#/network-lab/settings.ts";
import { breakpoints, colors, fontSize, networkLab, space } from "#/theme.ts";
import { Button } from "#/ui/Button.tsx";
import { Icon } from "#/ui/Icon.tsx";

// Borders (2), header (56), content padding (22), axis (8), gap (8),
// and exactly two channel rows. The wrapped header adds a 25px row + 12px gap.
const minimumHeight =
  2 +
  56 +
  2 * (space.md - 1) +
  fontSize.caption +
  space.sm +
  2 * networkLab.trafficRowHeight +
  space.xs;
const wrappedMinimumHeight = minimumHeight + 25 + space.md;

const sizeStorageKey = "solid-kanban:network-lab:size";
const openStorageKey = "solid-kanban:network-lab:open";

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
        const saved = JSON.parse(localStorage.getItem(sizeStorageKey) ?? "null");

        return {
          height: Number.isFinite(saved?.height) && saved.height > 0 ? saved.height : 240,
          width: Number.isFinite(saved?.width) && saved.width > 0 ? saved.width : undefined,
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

  const startResize = (event: PointerEvent & { currentTarget: HTMLElement }, corner: boolean) => {
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
        Math.min(availableHeight, resizeStart.height + resizeStart.y - event.clientY),
      ),
      width: resizeStart.corner
        ? Math.max(
            Math.min(360, availableWidth),
            Math.min(availableWidth, resizeStart.width + resizeStart.x - event.clientX),
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

  const configure = (next: Partial<NetworkSettings>) => {
    if (!props.lab) return;

    props.lab.configure(next);
    const { delayMs, jitter, faultRate } = props.lab.snapshot();
    setSaveFailed(!saveNetworkSettings({ delayMs, jitter, faultRate }));
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
              width: size().width === undefined ? undefined : `${size().width}px`,
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
            min-height: min(var(--network-lab-min-height), calc(100% - ${2 * space.lg}px));
            max-height: calc(100% - ${2 * space.lg}px);
            border-radius: ${space.lg}px;

            @media (max-width: ${networkLab.headerWrapWidth + 2 + 2 * space.lg}px) {
              --network-lab-min-height: ${wrappedMinimumHeight}px;
            }
            @media (max-width: ${breakpoints.phone}px) {
              left: ${space.sm}px;
              min-height: min(var(--network-lab-min-height), calc(100% - ${2 * space.sm}px));
              max-height: calc(100% - ${2 * space.sm}px);
            }
          `,
        open() &&
          size().width !== undefined &&
          size().width! <= networkLab.headerWrapWidth + 2 &&
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
            variant={snapshot().disconnected ? "danger-ghost" : "ghost"}
            pad="md"
            aria-expanded="false"
            onClick={toggle}
          >
            <Icon name={snapshot().disconnected ? "unplug" : "activity"} />
            Network lab
            <span
              class={css`
                color: ${colors.accent};
                font-size: ${fontSize.caption}px;
              `}
            >
              {snapshot().disconnected
                ? "Disconnected"
                : snapshot().delayMs === 0
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
        <NetworkControls
          snapshot={snapshot()}
          onConfigure={configure}
          onDisconnect={() => {
            const lab = props.lab;
            if (lab) lab.setDisconnected(!lab.snapshot().disconnected);
          }}
          onKill={() => props.lab?.killConnections()}
          onClose={toggle}
        />
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
        <NetworkTimeline rows={snapshot().rows} packets={snapshot().packets} />
      </Show>
    </dialog>
  );
}
