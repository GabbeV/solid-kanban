# Current — Solid 2 kanban demo

Boards, columns, cards, comments, and activity load from SpacetimeDB. You can create and rename boards and lists, create and edit cards, move them with a mouse, archive and restore them, add comments, and delete cards, lists, and boards. Deleting a list or board also deletes its contained cards and comments. Card creation, edits, and moves appear optimistically with a saving indicator. Unconfirmed changes remain in the client card store with retry and discard controls; the editor reads that same store. Edits save all editable fields with last-write-wins behavior.

## Stack

- Solid 2 `2.0.0-rc.13`, native compiler `2.0.0-rc.13`, Vite Start mode, and router `2.0.0-next.26`
- TypeScript/TSX, Vite 8, and csslit 0.0.12
- SpacetimeDB 2.10.1 with generated bindings in `src/module_bindings/`

Styles are colocated in each owning element's csslit class attribute; shared values live in `src/theme.ts`. No UI component or drag-and-drop library is used.

## Run locally

Use Node 24 and pnpm 10.32.1.

```sh
pnpm install --frozen-lockfile
pnpm db:start
```

In another terminal:

```sh
pnpm db:publish
pnpm dev
```

Open [http://127.0.0.1:3002](http://127.0.0.1:3002). The database runs on port 3001. The module seeds two boards on first publication; `db:publish` preserves existing data. The local CLI and database state live in ignored `.tools/` and `.spacetime/` directories. If the CLI is installed elsewhere, set `SPACETIME_BIN` to its executable path.

The app connects to `ws://127.0.0.1:3001` by default. Set `VITE_SPACETIMEDB_URI` to another WebSocket endpoint when both the server renderer and browser can reach it. The database name is `solid-kanban`; reads use anonymous connections, so no API key is needed for the local demo.

Development uses port 3002 with `strictPort`; stop an existing server before restarting. The normal Vite Start server responds to browser requests with `Accept: text/html`.

The **Network lab** button at the bottom opens a resizable distance view of browser traffic. Set one-way transit from real speed to 60 seconds and optionally add up to ±100% variation before moving a card. HTTP requests use one temporary row for request and response; each SpacetimeDB WebSocket connection uses separate outgoing and incoming rows. Frames on each WebSocket direction retain their send order despite variation, while independent HTTP requests can finish independently. This runs in the browser on hosted builds too. It delays application-visible frames and fetch responses, but does not simulate bandwidth or TCP backpressure.

## Data loading

`SpacetimeDBProvider` creates one SDK connection per server render and a fresh connection in the browser. Each `useTable` call starts a query subscription. The server waits for `onApplied`, reads the SDK cache, serializes the rows into Solid's SSR result, and closes the request connection. On hydration, a Solid 2 memo with `ssrSource: "hybrid"` retains those rows while the browser connection subscribes. Table callbacks reread the SDK cache and update a signal; the subscription is removed when its owner is released. `useRow` selects the first row of a primary-key query. There is no application API relay or separate server-side data model.

TypeScript and formatting checks are available with `pnpm typecheck` and
`pnpm format:check`. The browser checks in `scripts/check-*.mjs` run against
the development server; install their browsers with `pnpm exec playwright install`.

The production build currently fails in csslit/Vite's `vite:css-post` with
`Cannot read properties of undefined (reading 'get')`. Use the development
server while that upstream integration issue is unresolved.
