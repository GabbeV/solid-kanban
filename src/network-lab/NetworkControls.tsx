import { css } from "@csslit/core";
import { For } from "solid-js";
import { Button } from "#/ui/Button.tsx";
import { Select } from "#/ui/Select.tsx";
import { Icon } from "#/ui/Icon.tsx";
import { colors, fontSize, space, radius, networkLab } from "#/theme.ts";
import type { NetworkSnapshot, NetworkSettings } from "./core.ts";
import { delayOptions, speedVariations, faultRates } from "./settings.ts";

export function NetworkControls(props: {
  snapshot: NetworkSnapshot;
  onConfigure: (next: Partial<NetworkSettings>) => void;
  onDisconnect: () => void;
  onKill: () => void;
  onClose: () => void;
}) {
  return (
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

        @container (max-width: ${networkLab.headerWrapWidth}px) {
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
            {props.snapshot.disconnected
              ? "Disconnected"
              : `${props.snapshot.packets.length} in flight`}
          </span>
        </div>
      </div>
      <div
        role="group"
        aria-label="Network settings"
        class={css`
          grid-column: 2;
          grid-row: 1;
          display: flex;
          align-items: center;
          min-width: 0;
          gap: ${space.sm}px;

          @container (max-width: ${networkLab.headerWrapWidth}px) {
            grid-column: 1 / -1;
            grid-row: 2;
            display: grid;
            grid-template-columns:
              auto minmax(0, 1fr) minmax(0, 1fr)
              auto minmax(0, 1fr);
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
          aria-label="Round-trip delay"
          title="Simulated round-trip delay; each direction uses half"
          value={props.snapshot.delayMs}
          onChange={(event) =>
            props.onConfigure({ delayMs: Number(event.currentTarget.value) })
          }
        >
          <For each={delayOptions}>
            {(duration) => (
              <option value={duration}>
                {duration === 0
                  ? "0\u00a0ms"
                  : duration < 1000
                    ? `${duration}\u00a0ms`
                    : `${duration / 1000}\u00a0s`}
              </option>
            )}
          </For>
        </Select>
        <Select
          fitContent
          aria-label="Speed variation"
          value={props.snapshot.jitter}
          onChange={(event) =>
            props.onConfigure({ jitter: Number(event.currentTarget.value) })
          }
        >
          <For each={speedVariations}>
            {(variation) => (
              <option value={variation}>{`±${variation * 100}%`}</option>
            )}
          </For>
        </Select>
        <span
          class={css`
            font-size: ${fontSize.caption}px;
            color: ${colors.muted};
          `}
        >
          Faults
        </span>
        <Select
          fitContent
          aria-label="Fault rate"
          title="Failure chance per HTTP request/response pair; WebSocket messages use half the rate"
          value={props.snapshot.faultRate}
          onChange={(event) =>
            props.onConfigure({ faultRate: Number(event.currentTarget.value) })
          }
        >
          <For each={faultRates}>
            {(rate) => <option value={rate}>{rate * 100}%</option>}
          </For>
        </Select>
      </div>
      <div
        class={css`
          grid-column: 3;
          grid-row: 1;
          display: flex;
          align-items: center;
          gap: ${space.sm}px;

          @container (max-width: ${networkLab.headerWrapWidth}px) {
            grid-column: 2;
          }
        `}
      >
        <Button
          variant={props.snapshot.disconnected ? "danger" : "ghost"}
          pad="sm"
          iconOnly
          aria-label="Disconnect"
          aria-pressed={props.snapshot.disconnected ? "true" : "false"}
          title={
            props.snapshot.disconnected
              ? "Allow new connections"
              : "Disconnect and block new connections until toggled off"
          }
          onClick={props.onDisconnect}
        >
          <Icon name="unplug" />
        </Button>
        <Button
          variant="danger-ghost"
          pad="sm"
          iconOnly
          aria-label="Kill connections"
          title="Terminate active connections; allow automatic reconnection"
          onClick={props.onKill}
        >
          <Icon name="bolt" />
        </Button>
        <Button
          variant="ghost"
          pad="sm"
          iconOnly
          aria-label="Close Network lab"
          aria-expanded="true"
          title="Minimize network lab"
          onClick={props.onClose}
        >
          <Icon name="down" />
        </Button>
      </div>
    </header>
  );
}
