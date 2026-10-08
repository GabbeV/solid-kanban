import { css } from "@csslit/core";
import { fontSize, colors, space } from "#/theme.ts";

export function CardLabel(props: { label: string }) {
  return (
    <span
      class={[
        css`
          display: inline-flex;
          align-items: center;
          height: 17px;
          padding: ${space.xs}px;
          border-radius: 4px;
          font-size: ${fontSize.caption}px;
          font-weight: 560;

          background: ${colors.goldSurface};
          color: ${colors.goldText};
        `,
        props.label === "Design" &&
          css`
            background: ${colors.peachSurface};
            color: ${colors.peachText};
          `,
        props.label === "Engineering" &&
          css`
            background: ${colors.blueSurface};
            color: ${colors.blueText};
          `,
        props.label === "Research" &&
          css`
            background: ${colors.purpleSurface};
            color: ${colors.purpleText};
          `,
        props.label === "Content" &&
          css`
            background: ${colors.skySurface};
            color: ${colors.skyText};
          `,
      ]}
      data-label={props.label}
    >
      <span>{props.label}</span>
    </span>
  );
}
