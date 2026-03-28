import type { ContainerPort } from "../ports/container.port.js";

/**
 * Container adapter using testcontainers.
 * Wraps a GenericContainer for programmatic container lifecycle.
 */
export class TestcontainersAdapter implements ContainerPort {
  private image: string;
  private containerPort: number;
  private env: Record<string, string>;
  private reuse: boolean;
  private container: any = null;

  constructor(options: {
    image: string;
    port: number;
    env?: Record<string, string>;
    reuse?: boolean;
  }) {
    this.image = options.image;
    this.containerPort = options.port;
    this.env = options.env ?? {};
    this.reuse = options.reuse ?? false;
  }

  async start(): Promise<void> {
    const { GenericContainer, Wait } = await import("testcontainers");

    let builder = new GenericContainer(this.image).withExposedPorts(this.containerPort);

    for (const [key, value] of Object.entries(this.env)) {
      builder = builder.withEnvironment({ [key]: value });
    }

    if (this.image.startsWith("postgres")) {
      builder = builder.withWaitStrategy(
        Wait.forLogMessage(/database system is ready to accept connections/, 2),
      );
    }

    if (this.reuse) {
      builder = builder.withReuse();
    }

    this.container = await builder.start();
  }

  async stop(): Promise<void> {
    if (this.container && !this.reuse) {
      await this.container.stop();
      this.container = null;
    }
  }

  getMappedPort(containerPort: number): number {
    if (!this.container) {
      throw new Error("Container not started");
    }
    return this.container.getMappedPort(containerPort);
  }

  getHost(): string {
    if (!this.container) {
      throw new Error("Container not started");
    }
    return this.container.getHost();
  }

  getConnectionString(): string {
    return `${this.getHost()}:${this.getMappedPort(this.containerPort)}`;
  }

  async getLogs(): Promise<string> {
    if (!this.container) {
      return "";
    }

    const stream = await this.container.logs();
    return new Promise((resolve) => {
      let output = "";
      stream.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });
      stream.on("end", () => {
        resolve(output);
      });
      // Timeout after 1s if stream doesn't end
      setTimeout(() => {
        resolve(output);
      }, 1000);
    });
  }
}
