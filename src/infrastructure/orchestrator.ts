import { resolve } from "node:path";

import type { DatabasePort } from "../specification/ports/database.port.js";
import { TestcontainersAdapter } from "./adapters/testcontainers.adapter.js";
import {
  type ComposeConfig,
  detectServiceType,
  findComposeFile,
  parseComposeFile,
} from "./compose-parser.js";
import type { ContainerPort } from "./ports/container.port.js";
import { PostgresService } from "./services/postgres.service.js";
import { RedisService } from "./services/redis.service.js";

const DEFAULT_PORTS: Record<string, number> = {
  postgres: 5432,
  redis: 6379,
};

const DEFAULT_ENV: Record<string, Record<string, string>> = {
  postgres: {
    POSTGRES_DB: "test",
    POSTGRES_PASSWORD: "test",
    POSTGRES_USER: "test",
  },
};

interface RunningService {
  container: ContainerPort;
  handler: DatabasePort | null | RedisService;
  name: string;
  type: string;
}

/**
 * Orchestrator for test infrastructure.
 * Reads docker-compose.test.yaml, starts containers, wires adapters.
 */
export class Orchestrator {
  private composeConfig: ComposeConfig;
  private composeFilePath: string;
  private runningServices: RunningService[] = [];
  private started = false;

  constructor(projectRoot: string) {
    const composePath = findComposeFile(projectRoot);

    if (!composePath) {
      this.composeConfig = { services: [], appService: null, infraServices: [] };
      this.composeFilePath = resolve(projectRoot, "docker/compose.test.yaml");
    } else {
      this.composeFilePath = composePath;
      this.composeConfig = parseComposeFile(composePath);
    }
  }

  /**
   * Start all infrastructure containers.
   * Skips the app service (the thing being tested).
   */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    for (const service of this.composeConfig.infraServices) {
      const type = detectServiceType(service.image);

      if (type === "unknown" || type === "app") {
        continue;
      }

      const port = DEFAULT_PORTS[type];

      if (!port) {
        continue;
      }

      const env = { ...DEFAULT_ENV[type], ...service.environment };

      const container = new TestcontainersAdapter({
        image: service.image!,
        port,
        env,
      });

      await container.start();

      let handler: DatabasePort | null | RedisService = null;

      if (type === "postgres") {
        const pgService = new PostgresService(container, service, this.composeFilePath);
        await pgService.initialize();
        handler = pgService;
      } else if (type === "redis") {
        handler = new RedisService(container, service);
      }

      this.runningServices.push({
        name: service.name,
        type,
        container,
        handler,
      });
    }

    this.started = true;
  }

  /**
   * Stop all running containers.
   */
  async stop(): Promise<void> {
    for (const service of this.runningServices) {
      await service.container.stop();
    }
    this.runningServices = [];
    this.started = false;
  }

  /**
   * Get the database adapter (auto-detected from compose).
   * Returns the first database service found (postgres > sqlite).
   */
  getDatabase(): DatabasePort | null {
    const dbService = this.runningServices.find((s) => s.type === "postgres");
    return (dbService?.handler as DatabasePort) ?? null;
  }

  /**
   * Get a service's connection string by name.
   */
  getConnectionString(serviceName: string): null | string {
    const service = this.runningServices.find((s) => s.name === serviceName);
    return service?.container.getConnectionString() ?? null;
  }

  /**
   * Get the app service URL from compose (for e2e mode).
   */
  getAppUrl(): null | string {
    const appService = this.composeConfig.appService;

    if (!appService || appService.ports.length === 0) {
      return null;
    }

    const port = appService.ports[0].host ?? appService.ports[0].container;
    return `http://localhost:${port}`;
  }

  /**
   * Check if a compose file was found.
   */
  hasComposeFile(): boolean {
    return this.composeConfig.services.length > 0;
  }
}
