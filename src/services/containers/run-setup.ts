import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { refusal } from '../../../lint/refusal.js';
import { setupEntry } from '../../chain/paths/setup-entry.js';
import { loadPeer } from '../peer.js';
import { sweepOrphans } from './orphans.js';
import { field, RunContainers, serveContainers } from './run-containers.js';
import { SERVICE_IMAGES } from './service-images.js';
import { TestcontainersAdapter } from './testcontainers.adapter.js';

/** Every project's setup joins the one run's containers. Default images are pulled in the background, so the first file waits on a pull at most once; a project declaring no service needs no Docker. */

export const DOCKER_ABSENT = 'no Docker daemon answered';

export async function prepareDocker(): Promise<void> {
    const { getContainerRuntimeClient, ImageName } = await loadPeer(
        'testcontainers',
        'a declared service',
        async () => await import('testcontainers'),
    );
    let client: Awaited<ReturnType<typeof getContainerRuntimeClient>>;
    try {
        client = await getContainerRuntimeClient();
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(
            refusal({
                fix: 'start Docker (Docker Desktop, OrbStack, colima…) and run again',
                found: `a declared service asked for Docker, and ${DOCKER_ABSENT} (${reason})`,
                read: 'docs/17-services.md#one-container-per-run',
                why: 'A declared service runs in a container, so a project that declares one needs a Docker daemon.',
            }),
            { cause: error },
        );
    }
    await Promise.all([
        sweepOrphans(client.container.dockerode).catch(() => []),
        ...Object.values(SERVICE_IMAGES).map(async (image) => {
            const name = ImageName.fromString(image);
            if (await client.image.exists(name)) {
                return;
            }
            try {
                await client.image.pull(name);
            } catch {
                /* The start that needs the image pulls it again, and reports what failed */
            }
        }),
    ]);
}

export function servicesSetup(): string {
    return setupEntry(import.meta.dirname, 'run-setup.ts', 'services-setup.js');
}

type RunProject = { provide: (key: 'serviceContainers', value: string) => void };

type Joined = { leave: () => Promise<void>; url: string };

type RunServices = { enter: () => Promise<Joined> };

function packageVersion(): string {
    let dir = import.meta.dirname;
    while (!existsSync(join(dir, 'package.json'))) {
        const parent = dirname(dir);
        if (parent === dir) {
            return 'unversioned';
        }
        dir = parent;
    }
    const manifest: unknown = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    return String(field(manifest, 'version'));
}

/** On globalThis: vitest evaluates each project's setup in a module runner of its own, and the realm is what every runner shares. Versioned: two copies of the package in one run each open their own, never a registry whose protocol may differ. */
const RUN_SERVICES = Symbol.for(`@jterrazz/test.run-services@${packageVersion()}`);

function settled(prepare: () => Promise<void>): () => Promise<void> {
    // Settled here and rethrown on request: unasked, a refusal is nobody's.
    const prepared = (async (): Promise<Error | null> => {
        try {
            await prepare();
            return null;
        } catch (error) {
            return error instanceof Error
                ? error
                : new Error(
                      refusal({
                          fix: 'restart the Docker runtime, or reinstall the `testcontainers` peer',
                          found: `preparing Docker threw ${String(error)}, which is no Error`,
                          read: 'docs/04-operating.md#what-a-consumer-must-bring',
                          why: 'A service starts only on a Docker runtime that answers, through the peer that drives it.',
                      }),
                  );
        }
    })();
    return async () => {
        const refused = await prepared;
        if (refused !== null) {
            throw refused;
        }
    };
}

async function open(
    prepare: () => Promise<void>,
): Promise<{ close: () => Promise<void>; url: string }> {
    const containers = new RunContainers(
        (request) => new TestcontainersAdapter(request),
        settled(prepare),
    );
    const served = await serveContainers(containers);
    return {
        close: async () => {
            await served.close();
            await containers.stop();
        },
        url: served.url,
    };
}

type Open = typeof open;

function runServices(prepare: () => Promise<void>, opening: Open): RunServices {
    let holders = 0;
    let opened: null | ReturnType<typeof open> = null;
    const forget = (): void => {
        opened = null;
        Reflect.deleteProperty(globalThis, RUN_SERVICES);
    };
    return {
        enter: async () => {
            holders += 1;
            opened ??= opening(prepare);
            const current = opened;
            let served: Awaited<typeof current>;
            try {
                served = await current;
            } catch (error) {
                holders -= 1;
                forget();
                throw error;
            }
            let left = false;
            return {
                leave: async () => {
                    if (left) {
                        return;
                    }
                    left = true;
                    holders -= 1;
                    if (holders > 0) {
                        return;
                    }
                    forget();
                    await served.close();
                },
                url: served.url,
            };
        },
    };
}

function isRunServices(value: unknown): value is RunServices {
    return typeof field(value, 'enter') === 'function';
}

function theRun(prepare: () => Promise<void>, opening: Open): RunServices {
    const found: unknown = Reflect.get(globalThis, RUN_SERVICES);
    if (isRunServices(found)) {
        return found;
    }
    const created = runServices(prepare, opening);
    Reflect.set(globalThis, RUN_SERVICES, created);
    return created;
}

export default async function setup(
    project: RunProject,
    prepare: () => Promise<void> = prepareDocker,
    opening: Open = open,
): Promise<() => Promise<void>> {
    const joined = await theRun(prepare, opening).enter();
    project.provide('serviceContainers', joined.url);
    return joined.leave;
}
