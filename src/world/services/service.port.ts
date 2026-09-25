import type { ContainerOptions } from './containers/container.port.js';
import type { DatabasePort } from './database.port.js';
import type { IsolationStrategy } from './isolation.port.js';

/** A service handle, as `postgres()` or `redis()` return it; `connectionString` fills in once started. */
export type ServiceHandle = {
    readonly type: string;

    /** The kebab-case record key, assigned at start: `{ analyticsDb: postgres() }` reads `docker/analytics-db/`. */
    serviceName: null | string;

    /** Default container port for this service type. */
    readonly defaultPort: number;

    /** Default Docker image for this service type. */
    readonly defaultImage: string;

    /** Environment variables to pass to the container. */
    readonly environment: Record<string, string>;

    /** How the container runs beyond its image, port and environment — none when absent. */
    readonly containerOptions?: ContainerOptions;

    /** Connection string — populated after start. */
    connectionString: string;

    started: boolean;

    /** Build the connection string from host and port. */
    buildConnectionString: (host: string, port: number) => string;

    /** Create a DatabasePort adapter (if this is a database). Returns null otherwise. */
    createDatabaseAdapter: () => DatabasePort | null;

    /** Verify the service is ready and accepting connections. Throws with context if not. */
    healthcheck: () => Promise<void>;

    /** Run the init scripts from `<root>/docker/<name>/`; a cache goes under `<root>/.artifacts/`, never a machine-global directory. */
    initialize: (dockerDir: string, root: string) => Promise<void>;

    /** Reset state between tests (truncate tables, flush cache, etc.) */
    reset: () => Promise<void>;

    isolation: () => IsolationStrategy;
};
