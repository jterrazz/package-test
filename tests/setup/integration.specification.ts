import { afterAll } from "vitest";

import { integration, postgres } from "../../src/index.js";
import { createApp } from "../fixtures/app/app.js";

const db = postgres({ compose: "db" });

export const integrationSpec = await integration({
  services: [db],
  app: () => createApp({ databaseUrl: db.connectionString }),
  projectRoot: new URL("../fixtures/app", import.meta.url).pathname,
});

afterAll(() => integrationSpec.cleanup());
