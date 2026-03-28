import { afterAll } from "vitest";

import { integration, postgres, redis } from "../../src/index.js";
import { createApp } from "../fixtures/app/app.js";

const db = postgres({ compose: "db" });
const analyticsDb = postgres({ compose: "analytics-db" });
const cache = redis({ compose: "cache" });

export const integrationSpec = await integration({
  services: [db, analyticsDb, cache],
  app: () =>
    createApp({
      databaseUrl: db.connectionString,
      analyticsDatabaseUrl: analyticsDb.connectionString,
      redisUrl: cache.connectionString,
    }),
  root: "../fixtures/app",
});

afterAll(() => integrationSpec.cleanup());
