import type { DatabasePort } from "../../specification/ports/database.port.js";

/**
 * Configuration resolved from docker-compose.test.yaml for a service.
 */
export interface ComposeServiceConfig {
  image: string;
  port: number;
  environment: Record<string, string>;
  initScripts: string[];
}

/**
 * A service handle — returned by factory functions like postgres(), redis().
 * Mutable: connectionString is populated after the orchestrator starts containers.
 */
export interface ServiceHandle {
  /** Service type identifier. */
  readonly type: string;

  /** Compose service name (if linked). */
  readonly composeName: null | string;

  /** Default container port for this service type. */
  readonly defaultPort: number;

  /** Default Docker image for this service type. */
  readonly defaultImage: string;

  /** Environment variables to pass to the container. */
  readonly environment: Record<string, string>;

  /** Connection string — populated after start. */
  connectionString: string;

  /** Whether this service has been started. */
  started: boolean;

  /**
   * Build the connection string from host and port.
   */
  buildConnectionString(host: string, port: number): string;

  /**
   * Create a DatabasePort adapter (if this service is a database).
   * Returns null for non-database services (redis, etc.)
   */
  createDatabaseAdapter(): DatabasePort | null;

  /**
   * Reset state between tests (truncate tables, flush cache, etc.)
   */
  reset(): Promise<void>;

  /**
   * Run initialization scripts (e.g., init.sql from compose volumes).
   */
  initialize(composeDir: string): Promise<void>;
}
