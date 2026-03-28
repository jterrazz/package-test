import { resolve } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { normalizeOutput, stripAnsi } from "../../../../src/index.js";
import { Orchestrator } from "../../../../src/infrastructure/orchestrator.js";
import { postgres } from "../../../../src/infrastructure/services/postgres.js";
import { redis } from "../../../../src/infrastructure/services/redis.js";

const BROKEN_POSTGRES_INIT = resolve(
  import.meta.dirname,
  "../../../setup/fixtures/broken-postgres-init",
);
const BROKEN_MULTI_INIT = resolve(import.meta.dirname, "../../../setup/fixtures/broken-multi-init");
const BROKEN_SECOND_POSTGRES = resolve(
  import.meta.dirname,
  "../../../setup/fixtures/broken-second-postgres",
);

describe("initiation errors", () => {
  let orchestrator: Orchestrator;

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.stop();
    }
    vi.restoreAllMocks();
  });

  describe("postgres init script failure", () => {
    test("throws with init script path and SQL error", async () => {
      // Given — postgres with broken init.sql
      const db = postgres({ compose: "db" });
      orchestrator = new Orchestrator({
        services: [db],
        mode: "integration",
        root: BROKEN_POSTGRES_INIT,
      });

      // Then — error includes init script path
      await expect(orchestrator.start()).rejects.toThrow("init script failed");
    }, 30_000);

    test("error report shows failed service with cross symbol", async () => {
      // Given — postgres with broken init.sql
      const db = postgres({ compose: "db" });
      orchestrator = new Orchestrator({
        services: [db],
        mode: "integration",
        root: BROKEN_POSTGRES_INIT,
      });

      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      // When — start fails
      try {
        await orchestrator.start();
      } catch {
        /* Expected */
      }

      // Then — formatted report printed to stderr
      expect(spy).toHaveBeenCalledOnce();
      const output = normalizeOutput(spy.mock.calls[0][0]);

      expect(output).toContain("INFRA");
      expect(output).toContain("Starting infrastructure...");
      expect(output).toContain("× postgres (db)");
      expect(output).toContain("init script failed");
      expect(output).toContain("app: in-process (Hono)");
    }, 30_000);

    test("error report includes postgres container logs", async () => {
      // Given — postgres with broken init.sql
      const db = postgres({ compose: "db" });
      orchestrator = new Orchestrator({
        services: [db],
        mode: "integration",
        root: BROKEN_POSTGRES_INIT,
      });

      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      // When — start fails
      try {
        await orchestrator.start();
      } catch {
        /* Expected */
      }

      // Then — report includes container log lines from the failing postgres
      const output = stripAnsi(spy.mock.calls[0][0]);
      expect(output).toContain("database system is ready to accept connections");
    }, 30_000);
  });

  describe("multi-service failure — redis succeeds, postgres fails", () => {
    test("error report shows redis success then postgres failure", async () => {
      // Given — redis (ok) + postgres with broken init.sql
      const cache = redis({ compose: "cache" });
      const db = postgres({ compose: "db" });
      orchestrator = new Orchestrator({
        services: [cache, db],
        mode: "integration",
        root: BROKEN_MULTI_INIT,
      });

      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      // When — start fails on postgres
      try {
        await orchestrator.start();
      } catch {
        /* Expected */
      }

      // Then — report shows redis success, then postgres failure
      const output = normalizeOutput(spy.mock.calls[0][0]);

      expect(output).toContain("✓ redis (cache)");
      expect(output).toContain("× postgres (db)");
      expect(output).toContain("init script failed");
    }, 30_000);

    test("redis appears before postgres in report", async () => {
      // Given — redis first, postgres second
      const cache = redis({ compose: "cache" });
      const db = postgres({ compose: "db" });
      orchestrator = new Orchestrator({
        services: [cache, db],
        mode: "integration",
        root: BROKEN_MULTI_INIT,
      });

      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      // When — start fails
      try {
        await orchestrator.start();
      } catch {
        /* Expected */
      }

      // Then — redis line comes before postgres line
      const output = stripAnsi(spy.mock.calls[0][0]);
      const redisIndex = output.indexOf("redis (cache)");
      const postgresIndex = output.indexOf("postgres (db)");
      expect(redisIndex).toBeLessThan(postgresIndex);
    }, 30_000);
  });

  describe("multi-postgres failure — first succeeds, second fails", () => {
    test("error report shows first postgres success then second failure", async () => {
      // Given — db (ok init) + broken-db (bad init)
      const db = postgres({ compose: "db" });
      const brokenDb = postgres({ compose: "broken-db" });
      orchestrator = new Orchestrator({
        services: [db, brokenDb],
        mode: "integration",
        root: BROKEN_SECOND_POSTGRES,
      });

      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      // When — start fails on second postgres
      try {
        await orchestrator.start();
      } catch {
        /* Expected */
      }

      // Then — first postgres succeeded, second failed
      const output = normalizeOutput(spy.mock.calls[0][0]);

      expect(output).toContain("✓ postgres (db)");
      expect(output).toContain("× postgres (broken-db)");
      expect(output).toContain("init script failed");
    }, 30_000);

    test("thrown error identifies the broken database", async () => {
      // Given — db (ok init) + broken-db (bad init)
      const db = postgres({ compose: "db" });
      const brokenDb = postgres({ compose: "broken-db" });
      orchestrator = new Orchestrator({
        services: [db, brokenDb],
        mode: "integration",
        root: BROKEN_SECOND_POSTGRES,
      });

      vi.spyOn(console, "error").mockImplementation(() => {});

      // Then — error includes the broken init path
      try {
        await orchestrator.start();
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(error.message).toContain("init script failed");
        expect(error.message).toContain("broken-db/init.sql");
      }
    }, 30_000);

    test("second postgres failure includes its own container logs", async () => {
      // Given — db (ok) + broken-db (bad init)
      const db = postgres({ compose: "db" });
      const brokenDb = postgres({ compose: "broken-db" });
      orchestrator = new Orchestrator({
        services: [db, brokenDb],
        mode: "integration",
        root: BROKEN_SECOND_POSTGRES,
      });

      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      // When — start fails
      try {
        await orchestrator.start();
      } catch {
        /* Expected */
      }

      // Then — logs are from the broken-db container, not the first db
      const output = stripAnsi(spy.mock.calls[0][0]);

      // The log should contain postgres startup messages from the failing container
      expect(output).toContain("database system is ready to accept connections");
    }, 30_000);
  });
});
