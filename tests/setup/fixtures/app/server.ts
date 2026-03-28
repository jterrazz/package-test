import { serve } from "@hono/node-server";

import { createApp } from "./app.js";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://test:test@db:5432/test";
const analyticsDatabaseUrl =
  process.env.ANALYTICS_DATABASE_URL ?? "postgresql://test:test@analytics-db:5432/analytics";
const redisUrl = process.env.REDIS_URL ?? "redis://cache:6379";
const port = Number(process.env.PORT ?? 3000);

const app = createApp({ databaseUrl, analyticsDatabaseUrl, redisUrl });

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on port ${port}`);
});
