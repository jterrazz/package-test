import { serve } from "@hono/node-server";

import { BetterSqliteAdapter, e2e } from "../../../src/index.js";
import { createApp } from "../app/app.js";
import { createDatabase } from "../app/database.js";

// Each test file gets its own port to avoid conflicts in parallel execution
const PORT = 9800 + Math.floor(Math.random() * 100);

export const db = createDatabase();
export const app = createApp(db);

let server: null | ReturnType<typeof serve> = null;

export function startServer() {
  if (!server) {
    server = serve({ fetch: app.fetch, port: PORT });
  }
}

export function stopServer() {
  server?.close();
  server = null;
}

export const spec = e2e({
  database: new BetterSqliteAdapter(db),
  url: `http://localhost:${PORT}`,
});
