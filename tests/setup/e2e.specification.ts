import { afterAll } from "vitest";

import { e2e, postgres } from "../../src/index.js";
import { createApp } from "../fixtures/app/app.js";

const db = postgres({ compose: "db" });

export const e2eSpec = await e2e({
  services: [db],
  app: () => createApp({ databaseUrl: db.connectionString }),
});

afterAll(() => e2eSpec.cleanup());
