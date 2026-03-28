import { BetterSqliteAdapter, integration } from "../../../src/index.js";
import { createApp } from "../app/app.js";
import { createDatabase } from "../app/database.js";

export const db = createDatabase();
export const app = createApp(db);

export const spec = integration({
  database: new BetterSqliteAdapter(db),
  app,
});
