import { serve } from "@hono/node-server";

import { e2e, PrismaAdapter } from "../../src/index.js";
import { createApp } from "../fixtures/app/app.js";
import { createDatabase, initializeSchema } from "../fixtures/app/database.js";

const PORT = 9800 + Math.floor(Math.random() * 100);

const { prisma } = createDatabase();
await initializeSchema(prisma);
const app = createApp(prisma);

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

export const e2eSpec = e2e({
  database: new PrismaAdapter(prisma),
  url: `http://localhost:${PORT}`,
});
