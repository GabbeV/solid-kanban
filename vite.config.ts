import csslit from "@csslit/vite-plugin";
import solid from "@solidjs/vite-plugin";
import Inspect from "vite-plugin-inspect";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      dev: { command: "vp dev", cache: false },
      build: "vp build",
      start: { command: "node scripts/start.mjs", cache: false },
      typecheck: "tsc --noEmit",
      check: "vp check",
      "check:fix": { command: "vp check --fix", cache: false },
      lint: "vp lint",
      "lint:fix": { command: "vp lint --fix", cache: false },
      format: { command: "vp fmt", cache: false },
      "format:check": "vp fmt --check",
      "db:start": { command: "node scripts/database.mjs start", cache: false },
      "db:publish": { command: "node scripts/database.mjs publish", cache: false },
      "db:generate": { command: "node scripts/database.mjs generate", cache: false },
      "test:card-order": { command: "node scripts/check-card-order.mjs", cache: false },
      "test:network-dock": { command: "node scripts/check-network-dock.mjs", cache: false },
      "test:network-faults": { command: "node scripts/check-network-faults.mjs", cache: false },
      "test:network-lab": { command: "node scripts/check-network-lab.mjs", cache: false },
      "test:reconnect": { command: "node scripts/check-reconnect.mjs", cache: false },
      "test:reconnect-ui": { command: "node scripts/check-reconnect-ui.mjs", cache: false },
      "test:reducer-acks": { command: "node scripts/check-reducer-acks.mjs", cache: false },
      "test:subscriptions": { command: "node scripts/check-subscriptions.mjs", cache: false },
      test: {
        command: [
          "vp run test:card-order",
          "vp run test:subscriptions",
          "vp run test:reducer-acks",
          "vp run test:reconnect",
          "vp run test:reconnect-ui",
          "vp run test:network-lab",
          "vp run test:network-faults",
          "vp run test:network-dock",
        ],
        cache: false,
      },
    },
  },
  staged: { "*": "vp check --fix" },
  fmt: {
    ignorePatterns: ["src/module_bindings/**"],
    sortImports: {
      groups: ["type", ["builtin", "external"], ["subpath", "internal"], "unknown"],
    },
  },
  lint: {
    ignorePatterns: ["src/module_bindings/**"],
    plugins: ["typescript", "unicorn", "oxc", "import"],
    categories: { correctness: "error" },
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    options: {
      typeAware: true,
      typeCheck: true,
      denyWarnings: true,
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "typescript/consistent-type-imports": "error",
      "sort-imports": ["error", { ignoreDeclarationSort: true }],
      "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
      "import/extensions": [
        "error",
        "always",
        {
          checkTypeImports: true,
          ignorePackages: true,
          pathGroupOverrides: [{ pattern: "#/**", action: "enforce" }],
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["./**", "../**"], message: "Use a #/ import with its file extension." },
          ],
        },
      ],
    },
  },
  devtools: { apply: "serve" },
  // Keep direct signal imports from Solid's internal entry in the same runtime
  // graph as the optimized solid-js and @solidjs/web entries.
  optimizeDeps: { include: ["solid-js > @solidjs/signals"] },
  plugins: lazyPlugins(() => [
    csslit(),
    solid({
      start: { node: true },
      ssr: true,
      serverFunctions: true,
    }),
    Inspect(),
  ]),
  server: { host: "127.0.0.1", port: 3002, strictPort: true },
  preview: { host: "127.0.0.1", port: 3002, strictPort: true },
});
