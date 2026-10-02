# Styling

- Keep csslit templates directly in the owning element's `class` attribute.
- A template may style only that element and its pseudo-elements. Self states
  (`&:hover`, `&[data-variant="primary"]`) and ancestor conditions (`.foo &`) are
  allowed. Descendant, child, or sibling targets (`& .bar`, `& > *`, `& + div`)
  are not.
- The one `css.global` template in `src/App.tsx` is the exception, for basic
  resets and page setup only.
- Styled components own their styles. Do not pass them class names or compose
  their classes externally; expose variant props for supported differences.
- Reuse components rather than extracted csslit classes. Shared design constants
  belong in `src/theme.ts`.

# Reactivity

- Do not add effects (`createEffect`, `createRenderEffect`, or
  `createTrackedEffect`). Use Solid 2 reactive expressions and control flow.
- Route state and `latest` own editor visibility. Do not use `onSettled` to
  open modals or wait for unrelated actions before showing their skeletons.
- If the intended Solid 2 pattern is unclear, stop and ask for direction instead
  of introducing a workaround.
