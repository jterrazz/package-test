import { Readable } from 'node:stream';

import type { Testcontainers } from '../testcontainers.adapter.js';

/** Every call the builder and the started container receive, in order, as one line each. */
export type BuildLog = string[];

// invariant: cast at the seam: only the handful of builder calls the adapter makes are implemented.
function asPeer(stub: unknown): Testcontainers {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a stub implements the calls the adapter makes, never testcontainers' whole builder
    return stub as Testcontainers;
}

function started(log: BuildLog, image: string): object {
    return {
        getHost: () => 'docker.test',
        getMappedPort: (port: number) => port + 30_000,
        logs: async (options?: { since: number }) => {
            log.push(`logs ${JSON.stringify(options)}`);
            return await Promise.resolve(
                Readable.from([`${image} booted\n`, Buffer.from('ready\n')]),
            );
        },
        stop: async () => {
            log.push(`stop ${image}`);
            await Promise.resolve();
        },
    };
}

/** A peer whose containers start at once, logging how each was built. */
export function fakePeer(log: BuildLog): () => Promise<Testcontainers> {
    class GenericContainer {
        private readonly image: string;

        constructor(image: string) {
            this.image = image;
            log.push(`image ${image}`);
        }

        withCommand(command: string[]): this {
            return this.logged(`command ${command.join(' ')}`);
        }

        withEnvironment(environment: Record<string, string>): this {
            return this.logged(`env ${JSON.stringify(environment)}`);
        }

        withExposedPorts(port: number): this {
            return this.logged(`port ${port}`);
        }

        withLabels(labels: Record<string, string>): this {
            return this.logged(`labels ${Object.keys(labels).join(',')}`);
        }

        withReuse(): this {
            return this.logged('reuse');
        }

        withTmpFs(tmpfs: Record<string, string>): this {
            return this.logged(`tmpfs ${JSON.stringify(tmpfs)}`);
        }

        withWaitStrategy(strategy: string): this {
            return this.logged(`wait ${strategy}`);
        }

        async start(): Promise<object> {
            return await Promise.resolve(started(log, this.image));
        }

        private logged(line: string): this {
            log.push(line);
            return this;
        }
    }
    const Wait = {
        forLogMessage: (message: RegExp, times: number) => `${String(message)} x${times}`,
    };
    return async () => await Promise.resolve(asPeer({ GenericContainer, Wait }));
}
