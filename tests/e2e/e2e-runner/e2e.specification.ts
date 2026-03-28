import { serve } from "@hono/node-server";

import { BetterSqliteAdapter, e2e } from "../../../src/index.js";
import { createApp } from "../app/app.js";
import { createDatabase } from "../app/database.js";

export const db = createDatabase();
export const app = createApp(db);

const PORT = 9876;
let server: null | ReturnType<typeof serve> = null;

export function startServer() {
  server = serve({ fetch: app.fetch, port: PORT });
}

export function stopServer() {
  server?.close();
  server = null;
}

export const spec = e2e({
  database: new BetterSqliteAdapter(db),
  url: `http://localhost:${PORT}`,
});
