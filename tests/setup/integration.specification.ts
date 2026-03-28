import { integration, PrismaAdapter } from "../../src/index.js";
import { createApp } from "../fixtures/app/app.js";
import { createDatabase, initializeSchema } from "../fixtures/app/database.js";

const { prisma } = createDatabase();
await initializeSchema(prisma);
const app = createApp(prisma);

export const integrationSpec = await integration({
  database: new PrismaAdapter(prisma),
  app,
});
