import { For } from "solid-js";
import { css } from "@csslit/core";
import { space, boardLane, colors, control } from "#/theme.ts";
import { Skeleton } from "#/ui/Skeleton.tsx";

export function BoardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading board"
      class={css`
        display: flex;
        gap: ${space.md}px;
        align-items: flex-start;
        width: 100%;
        min-width: 0;
        max-height: 100%;
        overflow: clip;
        padding-block: ${space.xs}px ${space.md}px;
        mask-image:
          linear-gradient(to right, black 35%, transparent 80%),
          linear-gradient(to bottom, black 35%, transparent 80%);
        mask-composite: intersect;
      `}
    >
      <For each={[0, 1, 2, 3, 4, 5]}>
        {(lane) => (
          <div
            class={css`
              display: flex;
              flex-direction: column;
              gap: ${space.sm}px;
              min-width: 0;
              flex: none;
              width: clamp(
                ${boardLane.minWidth}px,
                (100cqi - ${space.md * (boardLane.lanesPerView - 1)}px) /
                  ${boardLane.lanesPerView},
                ${boardLane.maxWidth}px
              );
              border-radius: 10px;
              background: ${colors.soft};
              padding: ${space.sm}px;
            `}
          >
            <div
              class={css`
                padding: ${space.sm}px ${space.md}px;
              `}
            >
              <Skeleton height={10} width={96 + lane * 16} />
            </div>
            <For each={[0, 1, 2, 3]}>
              {() => (
                <div
                  class={css`
                    display: flex;
                    flex-direction: column;
                    gap: ${space.md}px;
                    padding: ${space.lg - 1}px;
                    border: 1px solid ${colors.border};
                    border-radius: 9px;
                    background: ${colors.paper};
                  `}
                >
                  <Skeleton height={9} width={120} />
                  <Skeleton height={16} />
                  <Skeleton height={9} width={144} />
                </div>
              )}
            </For>
            <Skeleton
              height={control.fontSize + 2 * space.md}
              variant="background"
            />
          </div>
        )}
      </For>
    </div>
  );
}
