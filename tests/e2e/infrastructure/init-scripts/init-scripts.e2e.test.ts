import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { TestcontainersAdapter } from "../../../../src/infrastructure/adapters/testcontainers.adapter.js";
import { postgres } from "../../../../src/infrastructure/services/postgres.js";

describe("init scripts", () => {
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
  }, 30_000);

  afterAll(async () => {
    await container.stop();
  });

  test("executes valid init.sql successfully", async () => {
    const sql = readFileSync(resolve(import.meta.dirname, "seeds/valid-init.sql"), "utf8");
    await db.seed(sql);

    const rows = await db.query("init_test", ["value"]);
    expect(rows).toEqual([["initialized"]]);

    await db.seed('DROP TABLE "init_test"');
  });

  test("fails fast on invalid SQL with clear error", async () => {
    const sql = readFileSync(resolve(import.meta.dirname, "seeds/invalid-init.sql"), "utf8");

    await expect(db.seed(sql)).rejects.toThrow();
  });

  test("reports SQL error context in initialize()", async () => {
    // Create a temp dir structure that mimics a compose project with bad init
    const { mkdtempSync, writeFileSync, mkdirSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");

    const tmpDir = mkdtempSync(resolve(tmpdir(), "init-test-"));
    mkdirSync(resolve(tmpDir, "postgres"), { recursive: true });
    writeFileSync(resolve(tmpDir, "postgres/init.sql"), 'CREATE TABLE "bad_table" (id INTEGERRR);');

    const initDb = postgres({ compose: "db" });
    initDb.connectionString = db.connectionString;
    initDb.started = true;

    await expect(initDb.initialize(tmpDir)).rejects.toThrow("init script failed");
  });
});
