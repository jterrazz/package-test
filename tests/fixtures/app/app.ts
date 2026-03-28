import { Hono } from "hono";

import type { PrismaClient } from "./generated/client/index.js";

export function createApp(prisma: PrismaClient) {
  const app = new Hono();

  app.get("/users", async (c) => {
    const users = await prisma.user.findMany({
      orderBy: { id: "asc" },
      select: { email: true, name: true },
    });
    return c.json({ users });
  });

  app.get("/users/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const user = await prisma.user.findUnique({
      where: { id },
      select: { email: true, name: true },
    });

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ user });
  });

  app.post("/users", async (c) => {
    const body = await c.req.json();
    const user = await prisma.user.create({
      data: { name: body.name, email: body.email },
      select: { email: true, name: true },
    });

    return c.json({ user }, 201);
  });

  return app;
}
