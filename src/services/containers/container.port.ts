/** A running service container (database, cache, ...). */
export type ContainerPort = {
    /** Start the container and wait until ready. */
    start: () => Promise<void>;

    /** Stop and remove the container. */
    stop: () => Promise<void>;

    /** Get the mapped host port for a container port. */
    getMappedPort: (containerPort: number) => number;

    /** Get the host to connect to. */
    getHost: () => string;

    /** Get a full connection string for this service. */
    getConnectionString: () => string;

    /** Get container logs (stdout + stderr): all of them, or those logged since a moment. */
    getLogs: (since?: Date) => Promise<string>;
};

export type ContainerRequest = ContainerOptions & {
    image: string;
    port: number;
    env?: Record<string, string>;
};

/** How a service asks its container to run, beyond its image, port and environment. */
export type ContainerOptions = {
    /** The command the image's entrypoint is handed, replacing its default. */
    command?: string[];
    /** Paths mounted as memory disks, each with its mount options. */
    tmpfs?: Record<string, string>;
};
