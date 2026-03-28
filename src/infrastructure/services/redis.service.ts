import type { ComposeService } from "../compose-parser.js";
import type { ContainerPort } from "../ports/container.port.js";

const DEFAULT_PORT = 6379;

/**
 * Redis service handler.
 * Knows how to connect, flush, and provide connection info.
 */
export class RedisService {
  private container: ContainerPort;
  private service: ComposeService;

  constructor(container: ContainerPort, service: ComposeService) {
    this.container = container;
    this.service = service;
  }

  getHost(): string {
    return this.container.getHost();
  }

  getPort(): number {
    return this.container.getMappedPort(DEFAULT_PORT);
  }

  getConnectionString(): string {
    return `redis://${this.getHost()}:${this.getPort()}`;
  }

  async reset(): Promise<void> {
    const { createClient } = await import("redis");
    const client = createClient({ url: this.getConnectionString() });
    await client.connect();
    try {
      await client.flushAll();
    } finally {
      await client.disconnect();
    }
  }
}
