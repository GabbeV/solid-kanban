import { css } from "@csslit/core";
import { colors, motion } from "#/theme.ts";

export function CardFlash(props: {
  tone: "rejected" | "remote";
  event: string | number;
  at?: number;
}) {
  return (
    <span
      aria-hidden="true"
      data-card-feedback={props.tone}
      data-feedback-event={props.event}
      style={{
        "animation-delay": `${Math.min(0, (props.at ?? Date.now()) - Date.now())}ms`,
      }}
      class={[
        css`
          position: absolute;
          inset: -1px;
          z-index: 1;
          pointer-events: none;
          border: 1px solid ${colors.accent};
          border-radius: inherit;
          opacity: 0;
          animation: card-feedback ${motion.cardFeedbackMs}ms ease-out;

          @keyframes card-feedback {
            0%,
            20% {
              opacity: 1;
            }
            100% {
              opacity: 0;
            }
          }
          @media (prefers-reduced-motion: reduce) {
            /* Keep a steady border, then remove it without a fade. */
            animation-timing-function: step-end;
          }
        `,
        props.tone === "rejected" &&
          css`
            border-color: ${colors.rejectedMove};
            z-index: 2;
          `,
      ]}
    />
  );
}
