import { afterAll } from "vitest";

import { e2e, PrismaAdapter } from "../../src/index.js";
import { createApp } from "../fixtures/app/app.js";
import { createDatabase, initializeSchema } from "../fixtures/app/database.js";

const { prisma } = createDatabase();
await initializeSchema(prisma);

export const e2eSpec = await e2e({
  database: new PrismaAdapter(prisma),
  app: () => createApp(prisma),
});

afterAll(() => e2eSpec.cleanup());
