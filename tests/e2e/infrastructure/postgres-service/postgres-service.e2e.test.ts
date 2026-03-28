import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { TestcontainersAdapter } from "../../../../src/infrastructure/adapters/testcontainers.adapter.js";
import { postgres } from "../../../../src/infrastructure/services/postgres.js";

describe("postgres service", () => {
  const db = postgres();
  let container: TestcontainersAdapter;

  beforeAll(async () => {
    container = new TestcontainersAdapter({
      image: "postgres:17",
      port: 5432,
      env: {
        POSTGRES_DB: "test",
        POSTGRES_PASSWORD: "test",
        POSTGRES_USER: "test",
      },
    });
    await container.start();

    const host = container.getHost();
    const port = container.getMappedPort(5432);
    db.connectionString = db.buildConnectionString(host, port);
    db.started = true;

    // Create table for testing
    await db.seed(
      'CREATE TABLE IF NOT EXISTS "users" (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE)',
    );
  }, 30_000);

  afterAll(async () => {
    await container.stop();
  });

  describe("connectionString", () => {
    test("builds a valid postgresql connection string", () => {
      expect(db.connectionString).toMatch(/^postgresql:\/\/test:test@/);
      expect(db.connectionString).toContain("/test");
    });
  });

  describe("seed", () => {
    test("executes SQL statements", async () => {
      await db.reset();
      await db.seed("INSERT INTO \"users\" (name, email) VALUES ('Alice', 'alice@test.com')");

      const rows = await db.query("users", ["name"]);
      expect(rows).toEqual([["Alice"]]);
    });

    test("executes multiple statements separated by semicolons", async () => {
      await db.reset();
      const sql = readFileSync(resolve(import.meta.dirname, "seeds/two-users.sql"), "utf8");
      await db.seed(sql);

      const rows = await db.query("users", ["name"]);
      expect(rows).toEqual([["Alice"], ["Bob"]]);
    });
  });

  describe("query", () => {
    test("returns rows as arrays of column values", async () => {
      await db.reset();
      await db.seed("INSERT INTO \"users\" (name, email) VALUES ('Alice', 'alice@test.com')");

      const rows = await db.query("users", ["name", "email"]);
      expect(rows).toEqual([["Alice", "alice@test.com"]]);
    });

    test("returns empty array when table is empty", async () => {
      await db.reset();

      const rows = await db.query("users", ["name"]);
      expect(rows).toEqual([]);
    });

    test("respects column order", async () => {
      await db.reset();
      await db.seed("INSERT INTO \"users\" (name, email) VALUES ('Alice', 'alice@test.com')");

      const rows = await db.query("users", ["email", "name"]);
      expect(rows).toEqual([["alice@test.com", "Alice"]]);
    });
  });

  describe("reset", () => {
    test("truncates all tables", async () => {
      await db.reset();
      await db.seed("INSERT INTO \"users\" (name, email) VALUES ('ResetUser', 'reset@test.com')");

      await db.reset();

      const rows = await db.query("users", ["name"]);
      expect(rows).toEqual([]);
    });

    test("allows re-inserting after reset", async () => {
      await db.reset();
      await db.seed("INSERT INTO \"users\" (name, email) VALUES ('First', 'first@test.com')");
      await db.reset();
      await db.seed("INSERT INTO \"users\" (name, email) VALUES ('Second', 'second@test.com')");

      const rows = await db.query("users", ["name"]);
      expect(rows).toEqual([["Second"]]);
    });
  });
});
