import type { DatabasePort } from "../../specification/ports/database.port.js";
import type { ServiceHandle } from "./service.port.js";

interface RedisOptions {
  /** Map to a service in docker-compose.test.yaml. */
  compose?: string;
  /** Override image. */
  image?: string;
}

class RedisHandle implements ServiceHandle {
  readonly type = "redis";
  readonly composeName: null | string;
  readonly defaultPort = 6379;
  readonly defaultImage: string;
  readonly environment: Record<string, string> = {};

  connectionString = "";
  started = false;

  constructor(options: RedisOptions = {}) {
    this.composeName = options.compose ?? null;
    this.defaultImage = options.image ?? "redis:7";
  }

  buildConnectionString(host: string, port: number): string {
    return `redis://${host}:${port}`;
  }

  createDatabaseAdapter(): DatabasePort | null {
    return null;
  }

  async initialize(): Promise<void> {
    // Redis doesn't need initialization scripts
  }

  async reset(): Promise<void> {
    const { createClient } = await import("redis");
    const client = createClient({ url: this.connectionString });
    await client.connect();
    try {
      await client.flushAll();
    } finally {
      await client.disconnect();
    }
  }
}

/**
 * Create a Redis service handle.
 *
 * @example
 * const cache = redis({ compose: "cache" });
 * // After start: cache.connectionString is populated
 */
export function redis(options: RedisOptions = {}): RedisHandle {
  return new RedisHandle(options);
}
