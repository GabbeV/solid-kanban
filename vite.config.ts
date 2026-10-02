import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import csslit from "@csslit/vite-plugin";
import Inspect from "vite-plugin-inspect";

export default defineConfig({
  devtools: true,
  // Keep direct signal imports from Solid's internal entry in the same runtime
  // graph as the optimized solid-js and @solidjs/web entries.
  optimizeDeps: { include: ["solid-js > @solidjs/signals"] },
  plugins: [
    csslit(),
    solid({
      start: { node: true },
      ssr: true,
      serverFunctions: true,
    }),
    Inspect(),
  ],
  server: { host: "127.0.0.1", port: 3002, strictPort: true },
  preview: { host: "127.0.0.1", port: 3002, strictPort: true },
});
