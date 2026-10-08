import { css } from "@csslit/core";
import { For } from "solid-js";
import { space } from "#/theme.ts";
import { labels } from "./cards";
import { Input } from "#/ui/Input.tsx";
import { Select } from "#/ui/Select.tsx";
import { useCardFilters } from "./card-filters";

export function CardFilters() {
  const filters = useCardFilters();
  return (
    <div
      class={css`
        display: flex;
        align-items: center;
        gap: ${space.sm}px;
        min-width: 0;
      `}
    >
      <span
        class={css`
          width: 180px;
          min-width: 0;
          flex-shrink: 1;
        `}
      >
        <Input
          icon="search"
          aria-label="Search cards"
          placeholder="Search cards…"
          value={filters.query()}
          onInput={(event) =>
            filters.setSearch(
              { q: event.currentTarget.value },
              { replace: true },
            )
          }
        />
      </span>
      <Select
        fitContent
        aria-label="Filter by label"
        value={filters.label()}
        onChange={(event) =>
          filters.setSearch({ label: event.currentTarget.value })
        }
      >
        <For each={labels}>
          {(label) => <option value={label}>{label || "All labels"}</option>}
        </For>
      </Select>
    </div>
  );
}
