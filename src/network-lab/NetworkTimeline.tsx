import type { NetworkPacket, NetworkRow } from "#/network-lab/core.ts";

import { css } from "@csslit/core";
import { For, Show } from "solid-js";

import { colors, fontSize, networkLab, radius, space } from "#/theme.ts";
import { Icon } from "#/ui/Icon.tsx";

function Packet(props: { packet: NetworkPacket }) {
  const position = () =>
    props.packet.direction === "in" ? 1 - props.packet.progress : props.packet.progress;
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

function TrafficRow(props: { row: NetworkRow; packets: readonly NetworkPacket[] }) {
  return (
    <div
      class={[
        css`
          display: grid;
          flex: none;
          height: ${networkLab.trafficRowHeight}px;
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
        title={props.row.error ?? props.row.label}
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
              display: flex;
              align-items: center;
              height: ${space.lg}px;
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
          {props.row.error ?? props.row.label}
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

export function NetworkTimeline(props: {
  rows: readonly NetworkRow[];
  packets: readonly NetworkPacket[];
}) {
  return (
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
          height: ${fontSize.caption}px;
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
        <For each={props.rows}>{(row) => <TrafficRow row={row} packets={props.packets} />}</For>
        <Show when={props.rows.length === 0}>
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
  );
}
