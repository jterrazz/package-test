/**
 * Abstract container interface.
 * Represents a running service (database, cache, etc.)
 */
export interface ContainerPort {
    /** Start the container and wait until ready. */
    start(): Promise<void>;

    /** Stop and remove the container. */
    stop(): Promise<void>;

    /** Get the mapped host port for a container port. */
    getMappedPort(containerPort: number): number;

    /** Get the host to connect to. */
    getHost(): string;

    /** Get a full connection string for this service. */
    getConnectionString(): string;

    /** Get container logs (stdout + stderr). */
    getLogs(): Promise<string>;
}
