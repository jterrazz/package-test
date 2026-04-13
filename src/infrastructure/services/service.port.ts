import type { DatabasePort } from '../../specification/ports/database.port.js';

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

    /** Build the connection string from host and port. */
    buildConnectionString(host: string, port: number): string;

    /** Create a DatabasePort adapter (if this is a database). Returns null otherwise. */
    createDatabaseAdapter(): DatabasePort | null;

    /** Verify the service is ready and accepting connections. Throws with context if not. */
    healthcheck(): Promise<void>;

    /** Run initialization scripts (e.g., init.sql). Throws with SQL error context if it fails. */
    initialize(composeDir: string): Promise<void>;

    /** Reset state between tests (truncate tables, flush cache, etc.) */
    reset(): Promise<void>;
}
