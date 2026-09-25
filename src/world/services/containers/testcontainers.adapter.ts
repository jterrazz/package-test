import { hostname } from 'node:os';

import { loadPeer } from '../peer.js';
import type { ContainerPort, ContainerRequest } from './container.port.js';

export const CONTAINER_LABEL = 'com.jterrazz.test';

export const REUSED_LABEL = 'com.jterrazz.test.reuse';

/** `<host>:<pid>`: a sweep removes the container once that process is dead, whatever reaper session holds it. */
export const OWNER_LABEL = 'com.jterrazz.test.owner';

export function processOwner(): string {
    return `${hostname()}:${process.pid}`;
}

/** Never on CI, where a run starts from nothing and leaves nothing. */
export function reuseEnabled(env: NodeJS.ProcessEnv): boolean {
    const onCi = env.CI !== undefined && env.CI !== '' && env.CI !== 'false';
    return env.TESTCONTAINERS_REUSE_ENABLE === 'true' && !onCi;
}

/** A reused container names no owner: its definition hash must not change with the process asking. */
export function containerLabels(reuse: boolean, owner: string): Record<string, string> {
    return reuse
        ? { [CONTAINER_LABEL]: 'true', [REUSED_LABEL]: 'true' }
        : { [CONTAINER_LABEL]: 'true', [OWNER_LABEL]: owner };
}

export class TestcontainersAdapter implements ContainerPort {
    private readonly image: string;
    private readonly containerPort: number;
    private readonly env: Record<string, string>;
    private readonly command: string[] | undefined;
    private readonly tmpfs: Record<string, string> | undefined;
    private readonly reuse: boolean;
    private container: any = null;

    constructor(options: ContainerRequest & { reuse?: boolean }) {
        this.image = options.image;
        this.containerPort = options.port;
        this.env = options.env ?? {};
        this.command = options.command;
        this.tmpfs = options.tmpfs;
        this.reuse = options.reuse ?? reuseEnabled(process.env);
    }

    async start(): Promise<void> {
        const { GenericContainer, Wait } = await loadPeer(
            'testcontainers',
            'a declared service',
            async () => await import('testcontainers'),
        );

        let builder = new GenericContainer(this.image)
            .withExposedPorts(this.containerPort)
            .withLabels(containerLabels(this.reuse, processOwner()));

        for (const [key, value] of Object.entries(this.env)) {
            builder = builder.withEnvironment({ [key]: value });
        }

        if (this.command !== undefined) {
            builder = builder.withCommand(this.command);
        }

        if (this.tmpfs !== undefined) {
            builder = builder.withTmpFs(this.tmpfs);
        }

        if (this.image.startsWith('postgres')) {
            builder = builder.withWaitStrategy(
                Wait.forLogMessage(/database system is ready to accept connections/u, 2),
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
            throw new Error('Container not started');
        }
        return this.container.getMappedPort(containerPort);
    }

    getHost(): string {
        if (!this.container) {
            throw new Error('Container not started');
        }
        return this.container.getHost();
    }

    getConnectionString(): string {
        return `${this.getHost()}:${this.getMappedPort(this.containerPort)}`;
    }

    async getLogs(since?: Date): Promise<string> {
        if (!this.container) {
            return '';
        }

        // The runtime reads `since` as UNIX seconds, a fraction taken as a fraction of one.
        const stream = await this.container.logs(
            since === undefined ? undefined : { since: since.getTime() / 1000 },
        );
        return await new Promise((resolve) => {
            let output = '';
            stream.on('data', (chunk: Buffer) => {
                output += chunk.toString();
            });
            stream.on('end', () => {
                resolve(output);
            });
            // Timeout after 1s if stream doesn't end
            setTimeout(() => {
                resolve(output);
            }, 1000);
        });
    }
}
