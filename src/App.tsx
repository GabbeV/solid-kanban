import { Loading } from "solid-js";
import "#/global-style.tsx";
import { css } from "@csslit/core";
import { colors, space, fontSize } from "#/theme.ts";
import { Router } from "#/routes.tsx";
import { DbConnection } from "#/module_bindings/index.ts";
import { SpacetimeDBProvider } from "#/spacetimedb.tsx";
import { createNetworkLab } from "#/network-lab/core.ts";
import { NetworkPanel } from "#/network-lab/NetworkPanel.tsx";
import { readNetworkSettings } from "#/network-lab/settings.ts";
import { NameProvider } from "#/name.tsx";

const databaseUri =
  import.meta.env.VITE_SPACETIMEDB_URI ?? "ws://127.0.0.1:3001";
const networkLab = import.meta.env.SSR
  ? undefined
  : createNetworkLab({
      interceptWebSocket: (url) => url.host === new URL(databaseUri).host,
      initialSettings: readNetworkSettings(),
    });

import.meta.hot?.dispose(() => networkLab?.dispose());

export default function App() {
  return (
    <>
      <NameProvider>
        <SpacetimeDBProvider
          connectionBuilder={DbConnection.builder()
            .withUri(databaseUri)
            .withDatabaseName("solid-kanban")}
        >
          <Loading
            fallback={
              <div
                role="status"
                class={css`
                  padding: ${space.xl}px;
                  color: ${colors.muted};
                  font-size: ${fontSize.control}px;
                `}
              >
                Loading workspace…
              </div>
            }
          >
            <Router />
          </Loading>
        </SpacetimeDBProvider>
      </NameProvider>
      <Loading fallback={null}>
        <NetworkPanel lab={networkLab} />
      </Loading>
    </>
  );
}
