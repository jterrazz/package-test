import { serve } from "@hono/node-server";

import { createApp } from "./app.js";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://test:test@db:5432/test";
const port = Number(process.env.PORT ?? 3000);

const app = createApp({ databaseUrl });

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on port ${port}`);
});
