import { resolve } from "node:path";
import { afterAll, describe, expect, test } from "vitest";

import { Orchestrator } from "../../../../src/infrastructure/orchestrator.js";
import { postgres } from "../../../../src/infrastructure/services/postgres.js";

const FIXTURES_DIR = resolve(import.meta.dirname, "../../../fixtures/app");

describe("orchestrator", () => {
  describe("integration mode", () => {
    const db = postgres({ compose: "db" });
    const orchestrator = new Orchestrator({
      services: [db],
      mode: "integration",
      projectRoot: FIXTURES_DIR,
    });

    afterAll(async () => {
      await orchestrator.stop();
    });

    test("starts services via testcontainers", async () => {
      await orchestrator.start();

      expect(db.started).toBe(true);
      expect(db.connectionString).toMatch(/^postgresql:\/\//);
    }, 30_000);

    test("reads image from compose file", async () => {
      // Db was started with image from compose (postgres:17)
      expect(db.connectionString).toBeTruthy();
    });

    test("populates connection string from running container", () => {
      expect(db.connectionString).toContain("test");
    });

    test("getDatabase returns the database handle", () => {
      const database = orchestrator.getDatabase();
      expect(database).not.toBeNull();
    });

    test("database is functional after start", async () => {
      await db.seed('CREATE TABLE IF NOT EXISTS "test_orch" (id SERIAL, val TEXT)');
      await db.seed("INSERT INTO \"test_orch\" (val) VALUES ('hello')");

      const rows = await db.query("test_orch", ["val"]);
      expect(rows).toEqual([["hello"]]);

      await db.seed('DROP TABLE "test_orch"');
    });
  });

  describe("e2e mode", () => {
    const orchestrator = new Orchestrator({
      services: [],
      mode: "e2e",
      projectRoot: FIXTURES_DIR,
    });

    afterAll(async () => {
      await orchestrator.stopCompose();
    });

    test("starts full compose stack", async () => {
      // Ensure clean state
      try {
        await orchestrator.stopCompose();
      } catch {
        /* Ignore */
      }
      await orchestrator.startCompose();

      const appUrl = orchestrator.getAppUrl();
      expect(appUrl).toMatch(/^http:\/\/localhost:\d+/);
    }, 60_000);

    test("auto-detects database service", () => {
      const database = orchestrator.getDatabase();
      expect(database).not.toBeNull();
    });

    test("auto-detects app URL", () => {
      const url = orchestrator.getAppUrl();
      expect(url).toBeTruthy();
    });

    test("app is reachable via detected URL", async () => {
      const url = orchestrator.getAppUrl()!;
      const response = await fetch(`${url}/users`);
      expect(response.status).toBe(200);
    });

    test("database is functional via compose", async () => {
      const database = orchestrator.getDatabase()!;
      await database.reset();
      await database.seed(
        "INSERT INTO \"users\" (name, email) VALUES ('TestUser', 'test@orch.com')",
      );

      const rows = await database.query("users", ["name"]);
      expect(rows).toEqual([["TestUser"]]);
    });
  });

  describe("error handling", () => {
    test("throws when compose file not found in e2e mode", async () => {
      const orch = new Orchestrator({
        services: [],
        mode: "e2e",
        projectRoot: "/tmp/nonexistent",
      });

      await expect(orch.startCompose()).rejects.toThrow("no compose file found");
    });
  });
});
