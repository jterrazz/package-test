import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { TestcontainersAdapter } from "../../../../src/infrastructure/adapters/testcontainers.adapter.js";
import { redis } from "../../../../src/infrastructure/services/redis.js";

describe("redis service", () => {
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

  describe("connectionString", () => {
    test("builds a valid redis connection string", () => {
      expect(cache.connectionString).toMatch(/^redis:\/\//);
    });
  });

  describe("reset", () => {
    test("flushes all keys", async () => {
      // Set a key
      const { createClient } = await import("redis");
      const client = createClient({ url: cache.connectionString });
      await client.connect();
      await client.set("test-key", "test-value");
      await client.disconnect();

      // Reset
      await cache.reset();

      // Verify empty
      const client2 = createClient({ url: cache.connectionString });
      await client2.connect();
      const value = await client2.get("test-key");
      await client2.disconnect();

      expect(value).toBeNull();
    });

    test("allows re-setting keys after reset", async () => {
      const { createClient } = await import("redis");

      // Set, reset, set again
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

      expect(value).toBe("value2");
      expect(oldValue).toBeNull();
    });
  });

  describe("compose integration", () => {
    test("compose name is stored", () => {
      const namedCache = redis({ compose: "cache" });
      expect(namedCache.composeName).toBe("cache");
    });

    test("default image is redis:7", () => {
      const defaultCache = redis();
      expect(defaultCache.defaultImage).toBe("redis:7");
    });

    test("custom image is stored", () => {
      const customCache = redis({ image: "redis:7-alpine" });
      expect(customCache.defaultImage).toBe("redis:7-alpine");
    });

    test("does not create a database adapter", () => {
      expect(cache.createDatabaseAdapter()).toBeNull();
    });
  });
});
