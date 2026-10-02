import { createRouter } from "@solidjs/router";
import type { RouteDefinition } from "@solidjs/router";
import { Loading } from "solid-js";

import "#/global-style.tsx";
import { Layout } from "#/Layout.tsx";
import { css } from "@csslit/core";
import { colors, fontSize, lineHeight, space } from "#/theme.ts";
import { BoardChrome } from "#/board/BoardChrome.tsx";
import { BoardBody } from "#/board/board/BoardBody.tsx";
import { ActivityBody } from "#/board/activity/ActivityBody.tsx";
import { ArchiveBody } from "#/board/archive/ArchiveBody.tsx";
import {
  globalDialogRoutes,
  headerDialogRoutes,
} from "#/board/dialogRoutes.tsx";
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

function WorkspaceRoute(props: { children?: unknown }) {
  return (
    <Layout>
      <BoardChrome>{props.children as never}</BoardChrome>
    </Layout>
  );
}

function BoardRoute(props: { children?: unknown }) {
  return (
    <Layout>
      <BoardChrome>{props.children as never}</BoardChrome>
    </Layout>
  );
}

const boardChildren: RouteDefinition[] = [
  {
    path: "/",
    component: BoardBody,
    info: { tab: "board" },
    children: [
      { path: "/" },
      { path: "/card/:cardId" },
      ...globalDialogRoutes,
      ...headerDialogRoutes,
    ],
  },
  {
    path: "/activity",
    component: ActivityBody,
    info: { tab: "activity" },
    children: [{ path: "/" }, ...globalDialogRoutes, ...headerDialogRoutes],
  },
  {
    path: "/archive",
    component: ArchiveBody,
    info: { tab: "archive" },
    children: [{ path: "/" }, ...globalDialogRoutes, ...headerDialogRoutes],
  },
];

const workspaceChildren: RouteDefinition[] = [
  {
    path: "/",
    component: BoardBody,
    info: { tab: "board" },
    children: [{ path: "/" }, ...globalDialogRoutes, ...headerDialogRoutes],
  },
];

const Router = createRouter({
  routes: [
    {
      path: "/",
      component: WorkspaceRoute,
      children: workspaceChildren,
    },
    {
      path: "/b/:boardId",
      component: BoardRoute,
      children: boardChildren,
    },
    {
      path: "*404",
      component: () => (
        <div
          class={css`
            padding: ${space.xl}px;
            color: ${colors.muted};
            text-align: center;
            font-size: ${fontSize.control}px;
            line-height: ${lineHeight.control}px;
          `}
        >
          {"This page does not exist. "}
          <a href="/">Back to the board</a>
        </div>
      ),
    },
  ],
});

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
