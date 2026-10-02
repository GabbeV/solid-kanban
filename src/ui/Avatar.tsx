import { css } from "@csslit/core";
import { colors, fontSize } from "#/theme.ts";

export function Avatar(props: { name: string; variant?: "compact" }) {
  return (
    <span
      class={[
        css`
          width: 24px;
          height: 24px;
          display: inline-flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: ${colors.avatarSand};
          color: ${colors.avatarSandText};
          font-size: ${fontSize.caption}px;

          font-weight: 650;
        `,
        props.variant === "compact" &&
          css`
            width: 21px;
            height: 21px;
            margin-block: -2px;
          `,
        (props.name.charCodeAt(0) || 0) % 4 === 1 &&
          css`
            background: ${colors.avatarSky};
            color: ${colors.avatarSkyText};
          `,
        (props.name.charCodeAt(0) || 0) % 4 === 2 &&
          css`
            background: ${colors.avatarRose};
            color: ${colors.avatarRoseText};
          `,
        (props.name.charCodeAt(0) || 0) % 4 === 3 &&
          css`
            background: ${colors.avatarBlue};
            color: ${colors.avatarBlueText};
          `,
      ]}
      title={props.name}
      aria-label={props.name}
    >
      <span>{props.name.slice(0, 2).toUpperCase()}</span>
    </span>
  );
}
