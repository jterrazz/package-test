import type { DatabasePort } from './database.port.js';
import type { IsolationStrategy } from './isolation.port.js';

/**
 * A service handle — returned by factory functions like postgres(), redis().
 * Mutable: connectionString is populated after the orchestrator starts containers.
 */
export type ServiceHandle = {
    /** Service type identifier. */
    readonly type: string;

    /**
     * The name this handle is known by. Left `null` until the orchestrator
     * assigns it at start time: it is the kebab-case form of the RECORD KEY,
     * so `{ analyticsDb: postgres() }` reports as `analytics-db` and reads its
     * init script from `docker/analytics-db/`. The key is the only name a
     * specification writes; a handle carries no second one of its own.
     */
    serviceName: null | string;

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
    buildConnectionString: (host: string, port: number) => string;

    /** Create a DatabasePort adapter (if this is a database). Returns null otherwise. */
    createDatabaseAdapter: () => DatabasePort | null;

    /** Verify the service is ready and accepting connections. Throws with context if not. */
    healthcheck: () => Promise<void>;

    /**
     * Run initialization scripts (e.g., init.sql). Throws with SQL error
     * context if it fails.
     *
     * `dockerDir` is `<root>/docker` — where a service reads its `init.sql`
     * from, under its own name. `root` is the project root the specification resolved
     * (A9), handed down so a service that CACHES something writes it under the
     * project's own `.artifacts/`, never in a machine-global directory two
     * checkouts would share.
     */
    initialize: (dockerDir: string, root: string) => Promise<void>;

    /** Reset state between tests (truncate tables, flush cache, etc.) */
    reset: () => Promise<void>;

    /** Get the isolation strategy for parallel test execution. */
    isolation: () => IsolationStrategy;
};
