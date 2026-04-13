export interface DockerContainerPort {
    /** Execute a command inside the container, return stdout */
    exec(cmd: string[]): Promise<string>;

    /** Read a file from inside the container */
    file(path: string): Promise<{ exists: boolean; content: string }>;

    /** Check if container is running */
    isRunning(): Promise<boolean>;

    /** Get container logs */
    logs(tail?: number): Promise<string>;

    /** Get full docker inspect JSON */
    inspect(): Promise<DockerInspectResult>;

    /** Check if a file/directory exists */
    exists(path: string): Promise<boolean>;
}

export interface DockerInspectResult {
    id: string;
    name: string;
    state: {
        running: boolean;
        exitCode: number;
        status: string;
    };
    config: {
        image: string;
        env: string[];
    };
    hostConfig: {
        memory: number;
        cpuQuota: number;
        networkMode: string;
        mounts: Array<{
            source: string;
            destination: string;
            type: string;
        }>;
    };
    networkSettings: {
        networks: Record<string, { gateway: string; ipAddress: string }>;
    };
}
