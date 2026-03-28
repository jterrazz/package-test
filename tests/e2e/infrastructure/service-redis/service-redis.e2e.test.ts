import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { TestcontainersAdapter } from "../../../../src/infrastructure/adapters/testcontainers.adapter.js";
import { redis } from "../../../../src/infrastructure/services/redis.js";

describe("redis service", () => {
  const cache = redis();
  let container: TestcontainersAdapter;

  beforeAll(async () => {
    container = new TestcontainersAdapter({ image: "redis:7", port: 6379 });
    await container.start();

    const host = container.getHost();
    const port = container.getMappedPort(6379);
    cache.connectionString = cache.buildConnectionString(host, port);
    cache.started = true;
  }, 30_000);

  afterAll(async () => {
    await container.stop();
  });

  describe("connectionString", () => {
    test("builds a valid redis connection string", () => {
      expect(cache.connectionString).toMatch(/^redis:\/\//);
    });
  });

  describe("healthcheck", () => {
    test("passes on healthy container", async () => {
      await expect(cache.healthcheck()).resolves.not.toThrow();
    });

    test("fails on unreachable host", async () => {
      // Given — connection string pointing to closed port
      const badCache = redis();
      badCache.connectionString = "redis://localhost:1";

      // Then — healthcheck fails with context
      await expect(badCache.healthcheck()).rejects.toThrow("healthcheck failed");
    });

    test("fails when no connection string set", async () => {
      await expect(redis().healthcheck()).rejects.toThrow("no connection string");
    });
  });

  describe("reset", () => {
    test("flushes all keys", async () => {
      // Given — a key exists
      const { createClient } = await import("redis");
      const client = createClient({ url: cache.connectionString });
      await client.connect();
      await client.set("test-key", "test-value");
      await client.disconnect();

      // When — reset
      await cache.reset();

      // Then — key is gone
      const client2 = createClient({ url: cache.connectionString });
      await client2.connect();
      const value = await client2.get("test-key");
      await client2.disconnect();
      expect(value).toBeNull();
    });

    test("allows re-setting keys after reset", async () => {
      // Given — key set, then reset, then new key set
      const { createClient } = await import("redis");

      const client1 = createClient({ url: cache.connectionString });
      await client1.connect();
      await client1.set("key1", "value1");
      await client1.disconnect();

      await cache.reset();

      const client2 = createClient({ url: cache.connectionString });
      await client2.connect();
      await client2.set("key2", "value2");
      const value = await client2.get("key2");
      const oldValue = await client2.get("key1");
      await client2.disconnect();

      // Then — new key exists, old key is gone
      expect(value).toBe("value2");
      expect(oldValue).toBeNull();
    });
  });

  describe("compose config", () => {
    test("stores compose name", () => {
      expect(redis({ compose: "cache" }).composeName).toBe("cache");
    });

    test("defaults to redis:7 image", () => {
      expect(redis().defaultImage).toBe("redis:7");
    });

    test("accepts custom image", () => {
      expect(redis({ image: "redis:7-alpine" }).defaultImage).toBe("redis:7-alpine");
    });

    test("does not create a database adapter", () => {
      expect(cache.createDatabaseAdapter()).toBeNull();
    });
  });
});
