import { hostname } from 'node:os';
import type { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';

import { invariant } from '../../chain/refusals/refusal.js';
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

/** The part of the `testcontainers` peer a container is built with. */
export type Testcontainers = { GenericContainer: typeof GenericContainer; Wait: typeof Wait };

async function loadTestcontainers(): Promise<Testcontainers> {
    return await loadPeer(
        'testcontainers',
        'a declared service',
        async () => await import('testcontainers'),
    );
}

export class TestcontainersAdapter implements ContainerPort {
    private readonly image: string;
    private readonly containerPort: number;
    private readonly env: Record<string, string>;
    private readonly command: string[] | undefined;
    private readonly tmpfs: Record<string, string> | undefined;
    private readonly reuse: boolean;
    private container: null | StartedTestContainer = null;
    private readonly peer: () => Promise<Testcontainers>;

    constructor(
        options: ContainerRequest & { reuse?: boolean },
        peer: () => Promise<Testcontainers> = loadTestcontainers,
    ) {
        this.peer = peer;
        this.image = options.image;
        this.containerPort = options.port;
        this.env = options.env ?? {};
        this.command = options.command;
        this.tmpfs = options.tmpfs;
        this.reuse = options.reuse ?? reuseEnabled(process.env);
    }

    async start(): Promise<void> {
        const { GenericContainer, Wait } = await this.peer();

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
            throw invariant('a container was read before it started');
        }
        return this.container.getMappedPort(containerPort);
    }

    getHost(): string {
        if (!this.container) {
            throw invariant('a container was read before it started');
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

        // outside: the runtime reads `since` as UNIX seconds, a fraction taken as a fraction of one.
        const stream = await this.container.logs(
            since === undefined ? undefined : { since: since.getTime() / 1000 },
        );
        return await new Promise((resolve) => {
            let output = '';
            stream.on('data', (chunk: unknown) => {
                output += Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
            });
            // Stryker disable StringLiteral,BlockStatement,CallExpression: an ended stream is answered by the fallback all the same, a second later
            stream.on('end', () => {
                resolve(output);
            });
            // Stryker restore StringLiteral,BlockStatement,CallExpression
            // outside: a running container's log stream follows it and never ends, so what it holds after a second is the answer.
            setTimeout(() => {
                resolve(output);
            }, 1000);
        });
    }
}
