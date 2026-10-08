import type * as db from "#/module_bindings/types.ts";

import { css } from "@csslit/core";
import { useLocation, useNavigate } from "@solidjs/router";
import { Errored, For, Loading, createOptimistic } from "solid-js";

import { tables } from "#/module_bindings/index.ts";
import { useName } from "#/name.tsx";
import { openDialog } from "#/nav.ts";
import { useTable } from "#/spacetimedb.tsx";
import { breakpoints, colors, fontSize, lineHeight, space } from "#/theme.ts";
import { Avatar } from "#/ui/Avatar.tsx";
import { Button } from "#/ui/Button.tsx";
import { Icon } from "#/ui/Icon.tsx";
import { Notice } from "#/ui/Notice.tsx";

export function Sidebar() {
  const { name } = useName();
  const boards = useTable(() => tables.board);
  const location = useLocation();
  const navigate = useNavigate();
  const [current, setCurrent] = createOptimistic(() => location.pathname.split("/")[2] ?? "studio");
  return (
    <aside
      class={css`
        border-right: 1px solid ${colors.border};
        background: ${colors.sidebar};
        padding: ${space.lg}px;
        padding-right: 15px;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        gap: ${space.lg}px;
        min-width: 0;
        min-height: 0;
        @media (max-width: ${breakpoints.compact}px) {
          padding: ${space.md}px;
          padding-bottom: 11px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          grid-template-rows: auto auto;
          gap: ${space.sm}px;
          border-bottom: 1px solid ${colors.border};
          border-right: 0;
        }
      `}
    >
      <a
        href="/"
        class={css`
          display: flex;
          align-items: center;
          gap: ${space.md}px;
          font-size: ${fontSize.brand}px;

          font-weight: 680;
          letter-spacing: -0.03em;
        `}
        aria-label="Current home"
      >
        <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="12" y="2" width="18" height="7" rx="2" fill={colors.skyDot} />
          <rect x="7" y="12" width="18" height="7" rx="2" fill={colors.accent} />
          <rect x="2" y="22" width="18" height="7" rx="2" fill={colors.primary} />
        </svg>
        <span>Current</span>
      </a>
      <div
        class={css`
          display: flex;
          flex-direction: column;
          gap: ${space.sm}px;
          min-width: 0;
          min-height: 0;
          overflow-y: auto;
          @media (max-width: ${breakpoints.compact}px) {
            grid-column: 1 / -1;
            grid-row: 2;
            overflow: visible;
          }
        `}
      >
        <p
          class={css`
            font-size: ${fontSize.caption}px;

            font-weight: 650;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: ${colors.muted};
            padding-inline: ${space.sm}px;
          `}
        >
          Boards
        </p>
        <nav
          class={css`
            display: flex;
            flex-direction: column;
            gap: ${space.xs}px;
            @media (max-width: ${breakpoints.compact}px) {
              flex-direction: row;
              overflow-x: auto;
            }
          `}
          aria-label="Boards"
        >
          <Errored
            fallback={(error, reset) => (
              <Notice>
                Couldn't load boards.
                <Button
                  variant="text"
                  type="button"
                  onClick={() => {
                    reset();
                  }}
                >
                  <span>Retry</span>
                </Button>
              </Notice>
            )}
          >
            <Loading
              fallback={
                <span
                  class={css`
                    font-size: ${fontSize.caption}px;

                    color: ${colors.muted};
                    @media (max-width: ${breakpoints.compact}px) {
                      flex-shrink: 0;
                      white-space: nowrap;
                    }
                  `}
                >
                  Loading boards…
                </span>
              }
            >
              <For each={boards()} keyed={(board) => board.id}>
                {(board) => (
                  <BoardLink
                    board={board()}
                    selected={current() === board().id}
                    onSelect={() => setCurrent(board().id)}
                  />
                )}
              </For>
            </Loading>
          </Errored>
          <Button
            variant="ghost"
            pad="sm"
            align="start"
            onClick={() => openDialog(navigate, location, "board")}
          >
            <Icon name="plus" />
            <span>Add board</span>
          </Button>
        </nav>
      </div>
      <div
        class={css`
          display: grid;
          min-width: 0;
          max-width: 100%;
          align-self: end;

          @media (max-width: ${breakpoints.compact}px) {
            grid-column: 2;
            grid-row: 1;
            justify-self: end;
          }
        `}
      >
        <Button
          variant="ghost"
          pad="sm"
          align="start"
          onClick={() => openDialog(navigate, location, "name")}
          aria-label={`Edit name, currently ${name()}`}
        >
          <Avatar name={name()} />
          <span
            class={css`
              min-width: 0;
              overflow: hidden;
              text-box-edge: text;
              text-overflow: ellipsis;
              white-space: nowrap;
            `}
          >
            {name()}
          </span>
          <Icon name="down" />
        </Button>
      </div>
    </aside>
  );
}

function BoardLink(props: { board: db.Board; selected: boolean; onSelect: () => void }) {
  return (
    <Button
      variant="ghost"
      pad="sm"
      align="start"
      href={`/b/${props.board.id}`}
      onClick={props.onSelect}
      aria-current={props.selected ? "page" : undefined}
    >
      <span
        class={[
          css`
            width: 9px;
            height: 9px;
            border-radius: 3px;
            background: ${colors.accent};
            flex: 0 0 auto;
          `,
          props.board.color === "orange" &&
            css`
              background: ${colors.orangeDot};
            `,
        ]}
      />
      <span
        class={css`
          min-width: 0;
          white-space: normal;
          overflow-wrap: anywhere;
          line-height: ${lineHeight.control}px;
          @media (max-width: ${breakpoints.compact}px) {
            white-space: nowrap;
          }
        `}
      >
        {props.board.title}
      </span>
    </Button>
  );
}
