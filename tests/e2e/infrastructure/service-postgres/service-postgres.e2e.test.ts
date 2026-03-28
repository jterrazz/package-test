import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
      env: { POSTGRES_DB: "test", POSTGRES_PASSWORD: "test", POSTGRES_USER: "test" },
    });
    await container.start();

    const host = container.getHost();
    const port = container.getMappedPort(5432);
    db.connectionString = db.buildConnectionString(host, port);
    db.started = true;

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

  describe("healthcheck", () => {
    test("passes on healthy container", async () => {
      await expect(db.healthcheck()).resolves.not.toThrow();
    });

    test("fails on unreachable host", async () => {
      const badDb = postgres();
      badDb.connectionString = "postgresql://test:test@localhost:1/test";

      await expect(badDb.healthcheck()).rejects.toThrow("healthcheck failed");
    });

    test("fails when no connection string set", async () => {
      const noConn = postgres();

      await expect(noConn.healthcheck()).rejects.toThrow("no connection string");
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

    test("fails fast on invalid SQL", async () => {
      await expect(db.seed('CREATE TABLE "bad" (id INTEGERRR)')).rejects.toThrow();
    });
  });

  describe("initialize", () => {
    test("runs init.sql from compose directory", async () => {
      await db.reset();

      const tmpDir = mkdtempSync(resolve(tmpdir(), "init-test-"));
      mkdirSync(resolve(tmpDir, "postgres"), { recursive: true });
      writeFileSync(
        resolve(tmpDir, "postgres/init.sql"),
        'CREATE TABLE IF NOT EXISTS "init_test" (id SERIAL, val TEXT); INSERT INTO "init_test" (val) VALUES (\'ok\');',
      );

      const initDb = postgres({ compose: "db" });
      initDb.connectionString = db.connectionString;
      initDb.started = true;

      await initDb.initialize(tmpDir);

      const rows = await db.query("init_test", ["val"]);
      expect(rows).toEqual([["ok"]]);

      await db.seed('DROP TABLE "init_test"');
    });

    test("reports SQL error context on failure", async () => {
      const tmpDir = mkdtempSync(resolve(tmpdir(), "init-fail-"));
      mkdirSync(resolve(tmpDir, "postgres"), { recursive: true });
      writeFileSync(resolve(tmpDir, "postgres/init.sql"), 'CREATE TABLE "bad" (id INTEGERRR);');

      const initDb = postgres({ compose: "db" });
      initDb.connectionString = db.connectionString;
      initDb.started = true;

      await expect(initDb.initialize(tmpDir)).rejects.toThrow("init script failed");
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
