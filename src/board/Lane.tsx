import { For, Show } from "solid-js";
import { css } from "@csslit/core";
import type { Lane as LaneData } from "#/module_bindings/types.ts";
import { space, boardLane, colors, fontSize, lineHeight } from "#/theme.ts";
import { Button } from "#/ui/Button.tsx";
import { Icon } from "#/ui/Icon.tsx";
import { CardTile, type CardDrag } from "./CardTile";
import { AddCard } from "./AddCard";
import type { CardState, ViewCard } from "./card-state";

export type DropPosition = { laneId: string; beforeId: string };

export function Lane(props: {
  lane: LaneData;
  cards: readonly ViewCard[];
  cardState: CardState;
  drop?: DropPosition;
  drag: CardDrag;
  commentCount: (id: string) => number;
  hasFilters: boolean;
  onEdit: () => void;
}) {
  return (
    <section
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
        min-height: 120px;
        padding: ${space.sm}px;
      `}
      data-lane-id={props.lane.id}
      aria-label={props.lane.title}
    >
      <header
        class={css`
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: ${space.sm}px ${space.md}px;
        `}
      >
        <h2
          class={css`
            display: flex;
            align-items: center;
            gap: ${space.sm}px;
            font-size: ${fontSize.control}px;
            line-height: ${lineHeight.control}px;

            font-weight: 640;
            letter-spacing: 0;
          `}
        >
          <span
            class={[
              css`
                width: 9px;
                height: 9px;
                background: ${colors.neutralDot};
                border-radius: 50%;
              `,
              props.lane.position % 4 === 1 &&
                css`
                  background: ${colors.orangeDot};
                `,
              props.lane.position % 4 === 2 &&
                css`
                  background: ${colors.blueDot};
                `,
              props.lane.position % 4 === 3 &&
                css`
                  background: ${colors.skyDot};
                `,
            ]}
          />
          <span>{props.lane.title}</span>
          <span
            class={css`
              font-size: ${fontSize.caption}px;
              color: ${colors.muted};
              font-weight: 500;
            `}
          >
            {props.cards.length}
          </span>
        </h2>
        <Button
          variant="ghost"
          iconOnly
          pad="sm"
          bleed
          aria-label={`Rename ${props.lane.title}`}
          onClick={props.onEdit}
        >
          <Icon name="more" />
        </Button>
      </header>
      <div
        class={css`
          display: flex;
          flex-direction: column;
          gap: ${space.sm}px;
        `}
      >
        <Show when={props.cards.length === 0}>
          <p
            class={[
              css`
                margin: 0;
                border: 1px dashed ${colors.border};
                border-radius: 7px;
                padding: 23px;
                text-align: center;
                font-size: ${fontSize.caption}px;
                color: ${colors.muted};
              `,
              props.drop?.laneId === props.lane.id &&
                css`
                  border-style: solid;
                  border-color: ${colors.accent};
                  background: ${colors.selected};
                  color: ${colors.primary};
                `,
            ]}
          >
            {props.hasFilters ? "No matching cards" : "No cards"}
          </p>
        </Show>
        <For each={props.cards} keyed={(card) => card.id}>
          {(card) => {
            return (
              <>
                <Show
                  when={
                    props.drop?.laneId === props.lane.id &&
                    props.drop?.beforeId === card().id
                  }
                >
                  <div
                    data-drop-line
                    class={css`
                      flex: none;
                      height: 2px;
                      margin-block: -${(space.sm + 2) / 2}px;
                      border-radius: 1px;
                      background: ${colors.accent};
                    `}
                  />
                </Show>
                <CardTile
                  card={card()}
                  cardState={props.cardState}
                  drag={props.drag}
                  commentCount={props.commentCount(card().id)}
                />
              </>
            );
          }}
        </For>
        <Show
          when={
            props.drop?.laneId === props.lane.id && props.drop?.beforeId === ""
          }
        >
          <div
            data-drop-line
            class={[
              css`
                flex: none;
                height: 2px;
                margin-block: -${(space.sm + 2) / 2}px;
                border-radius: 1px;
                background: ${colors.accent};
              `,
              props.cards.length === 0 &&
                css`
                  visibility: hidden;
                `,
            ]}
          />
        </Show>
        <AddCard
          lane={props.lane}
          cards={props.cardState.cards}
          createCard={props.cardState.createCard}
        />
      </div>
    </section>
  );
}
