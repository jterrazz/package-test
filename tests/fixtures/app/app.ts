import { Hono } from "hono";

export function createApp(options: { databaseUrl: string }) {
  const app = new Hono();

  async function query(sql: string, params: unknown[] = []) {
    const { Client } = await import("pg");
    const client = new Client({ connectionString: options.databaseUrl });
    await client.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      await client.end();
    }
  }

  app.get("/users", async (c) => {
    const users = await query('SELECT name, email FROM "users" ORDER BY id');
    return c.json({ users });
  });

  app.get("/users/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const rows = await query('SELECT name, email FROM "users" WHERE id = $1', [id]);

    if (rows.length === 0) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ user: rows[0] });
  });

  app.post("/users", async (c) => {
    const body = await c.req.json();
    const rows = await query(
      'INSERT INTO "users" (name, email) VALUES ($1, $2) RETURNING name, email',
      [body.name, body.email],
    );

    return c.json({ user: rows[0] }, 201);
  });

  return app;
}
