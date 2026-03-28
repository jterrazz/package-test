import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { TestcontainersAdapter } from "../../../../src/infrastructure/adapters/testcontainers.adapter.js";
import { postgres } from "../../../../src/infrastructure/services/postgres.js";
import { redis } from "../../../../src/infrastructure/services/redis.js";

describe("healthcheck", () => {
  describe("postgres", () => {
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

  describe("redis", () => {
    const cache = redis();
    let container: TestcontainersAdapter;

    beforeAll(async () => {
      container = new TestcontainersAdapter({
        image: "redis:7",
        port: 6379,
      });
      await container.start();

      const host = container.getHost();
      const port = container.getMappedPort(6379);
      cache.connectionString = cache.buildConnectionString(host, port);
      cache.started = true;
    }, 30_000);

    afterAll(async () => {
      await container.stop();
    });

    test("passes on healthy container", async () => {
      await expect(cache.healthcheck()).resolves.not.toThrow();
    });

    test("fails on unreachable host", async () => {
      const badCache = redis();
      badCache.connectionString = "redis://localhost:1";

      await expect(badCache.healthcheck()).rejects.toThrow("healthcheck failed");
    });

    test("fails when no connection string set", async () => {
      const noConn = redis();

      await expect(noConn.healthcheck()).rejects.toThrow("no connection string");
    });
  });
});
