import { useSearchParams } from "@solidjs/router";
import type { Card } from "#/module_bindings/types.ts";

export function useCardFilters() {
  const [search, setSearch] = useSearchParams();
  const query = () => (typeof search.q === "string" ? search.q : "");
  const label = () => (typeof search.label === "string" ? search.label : "");
  const hasFilters = () => Boolean(query().trim() || label());
  const matches = (card: Card) => {
    const text = query().trim().toLocaleLowerCase();
    return (
      (!label() || card.label === label()) &&
      (!text ||
        `${card.title} ${card.description}`.toLocaleLowerCase().includes(text))
    );
  };

  return { query, label, hasFilters, matches, setSearch };
}
