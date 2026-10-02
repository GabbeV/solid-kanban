import { css } from "@csslit/core";
import { fontSize, space } from "#/theme.ts";
import { Skeleton } from "#/ui/Skeleton.tsx";

export function CardCommentsSkeleton() {
  return (
    <article
      aria-hidden="true"
      class={css`
        display: flex;
        align-items: flex-start;
        gap: ${space.sm}px;
        padding: ${space.sm}px 0;
        mask-image: linear-gradient(to bottom, black 35%, transparent 80%);
      `}
    >
      <Skeleton height={24} width={24} circle />
      <div
        class={css`
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: ${space.sm}px;
        `}
      >
        <header
          class={css`
            display: flex;
            align-items: center;
            gap: ${space.sm}px;
          `}
        >
          <Skeleton height={fontSize.body} width={80} />
          <Skeleton height={fontSize.caption} width={48} />
        </header>
        <Skeleton height={fontSize.body} width={340} />
      </div>
    </article>
  );
}
