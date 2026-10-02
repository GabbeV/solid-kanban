import { serve } from "../dist/server/node.js";

// Share the development/test port and let EADDRINUSE expose stale servers.
serve({ port: 3002, host: "127.0.0.1" });
