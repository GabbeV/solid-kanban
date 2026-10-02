import { css } from "@csslit/core";
import type { JSX } from "@solidjs/web";
import { omit } from "solid-js";
import { colors, radius, control, space } from "#/theme.ts";
import { Icon } from "#/ui/Icon.tsx";

export function Input(
  props: Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "class"> & {
    icon?: string;
  },
) {
  const input = (
    <input
      {...omit(props, "icon")}
      class={[
        css`
          display: block;
          width: 100%;
          min-width: 0;
          height: 33px;
          border: 1px solid ${colors.border};
          border-radius: ${radius.control}px;
          background: ${colors.paper};
          padding: ${control.pad}px;
          color: ${colors.ink};
          font-size: ${control.fontSize}px;

          &:disabled {
            opacity: 0.55;
          }
        `,
        props.icon &&
          css`
            padding-left: ${space.md + 11 + space.sm}px;
          `,
        props.type === "date" &&
          css`
            /* The native Firefox date segments need 15px of content height. */
            padding-block: ${space.sm}px;
          `,
      ]}
    />
  );

  return props.icon ? (
    <span
      class={css`
        position: relative;
        display: block;
        width: 100%;
        min-width: 0;
      `}
    >
      <span
        class={css`
          position: absolute;
          left: ${space.md}px;
          top: 50%;
          display: grid;
          width: 9px;
          height: 9px;
          place-items: center;
          transform: translateY(-50%);
          color: ${colors.muted};
          pointer-events: none;
        `}
      >
        <Icon name={props.icon} />
      </span>
      {input}
    </span>
  ) : (
    input
  );
}
