import type Database from "better-sqlite3";
import { Hono } from "hono";

export function createApp(db: ReturnType<typeof Database>) {
  const app = new Hono();

  app.get("/users", (c) => {
    const users = db.prepare("SELECT id, name, email FROM users").all();
    return c.json({ users });
  });

  app.get("/users/:id", (c) => {
    const user = db
      .prepare("SELECT id, name, email FROM users WHERE id = ?")
      .get(c.req.param("id"));

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ user });
  });

  app.post("/users", async (c) => {
    const body = await c.req.json();
    const { name, email } = body;

    const result = db.prepare("INSERT INTO users (name, email) VALUES (?, ?)").run(name, email);

    const user = db
      .prepare("SELECT id, name, email FROM users WHERE id = ?")
      .get(result.lastInsertRowid);

    return c.json({ user }, 201);
  });

  return app;
}
