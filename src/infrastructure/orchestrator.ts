import { dirname } from "node:path";

import type { DatabasePort } from "../specification/ports/database.port.js";
import { TestcontainersAdapter } from "./adapters/testcontainers.adapter.js";
import { findComposeFile, parseComposeFile } from "./compose-parser.js";
import type { ContainerPort } from "./ports/container.port.js";
import { printReport } from "./reporter.js";
import type { ServiceHandle } from "./services/service.port.js";

interface RunningService {
  handle: ServiceHandle;
  container: ContainerPort | null;
}

interface OrchestratorOptions {
  services: ServiceHandle[];
  mode: "e2e" | "integration";
  projectRoot?: string;
}

/**
 * Orchestrator for test infrastructure.
 * Starts services via testcontainers, reads config from compose.
 */
export class Orchestrator {
  private services: ServiceHandle[];
  private mode: "e2e" | "integration";
  private projectRoot: string;
  private running: RunningService[] = [];
  private started = false;

  constructor(options: OrchestratorOptions) {
    this.services = options.services;
    this.mode = options.mode;
    this.projectRoot = options.projectRoot ?? process.cwd();
  }

  /**
   * Start all declared services via testcontainers.
   * Reads image/env config from docker-compose.test.yaml if a service has compose: "name".
   */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    const composePath = findComposeFile(this.projectRoot);
    const composeDir = composePath ? dirname(composePath) : this.projectRoot;
    const composeConfig = composePath ? parseComposeFile(composePath) : null;

    const reports: { handle: ServiceHandle; durationMs: number; error?: string }[] = [];

    for (const handle of this.services) {
      const startTime = Date.now();

      try {
        // Resolve config from compose if linked
        let image = handle.defaultImage;
        let env = { ...handle.environment };

        if (handle.composeName && composeConfig) {
          const composeService = composeConfig.services.find((s) => s.name === handle.composeName);
          if (composeService) {
            image = composeService.image ?? image;
            env = { ...env, ...composeService.environment };
          }
        }

        // Start container via testcontainers
        const container = new TestcontainersAdapter({
          image,
          port: handle.defaultPort,
          env,
        });
        await container.start();

        const host = container.getHost();
        const port = container.getMappedPort(handle.defaultPort);
        handle.connectionString = handle.buildConnectionString(host, port);

        // Run init scripts
        await handle.initialize(composeDir);
        handle.started = true;

        reports.push({ handle, durationMs: Date.now() - startTime });
        this.running.push({ handle, container });
      } catch (error: any) {
        reports.push({
          handle,
          durationMs: Date.now() - startTime,
          error: error.message,
        });
        throw error;
      }
    }

    this.started = true;

    printReport(this.mode, reports, {
      type: this.mode === "integration" ? "in-process" : "http",
    });
  }

  /**
   * Stop all running containers.
   */
  async stop(): Promise<void> {
    for (const { container } of this.running) {
      if (container) {
        await container.stop();
      }
    }
    this.running = [];
    this.started = false;
  }

  /**
   * Get the first database service.
   */
  getDatabase(): DatabasePort | null {
    for (const handle of this.services) {
      const adapter = handle.createDatabaseAdapter();
      if (adapter) {
        return adapter;
      }
    }
    return null;
  }
}
