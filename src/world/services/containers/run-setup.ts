import { setupEntry } from '../../../kernel/files/setup-entry.js';
import { loadPeer } from '../peer.js';
import { sweepOrphans } from './orphans.js';
import { RunContainers, serveContainers } from './run-containers.js';
import { SERVICE_IMAGES } from './service-images.js';
import { TestcontainersAdapter } from './testcontainers.adapter.js';

/** One per vitest project. Default images are pulled in the background, so the first file waits on a pull at most once; a project declaring no service needs no Docker. */

export const DOCKER_ABSENT =
    'declared services need Docker, and no Docker daemon answered — start Docker (Docker Desktop, OrbStack, colima…) and run again';

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
        throw new Error(`${DOCKER_ABSENT} (${reason})`, { cause: error });
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

export default async function setup(
    project: RunProject,
    prepare: () => Promise<void> = prepareDocker,
): Promise<() => Promise<void>> {
    // Settled here and rethrown on request: unasked, a refusal is nobody's.
    const refusal = (async (): Promise<Error | null> => {
        try {
            await prepare();
            return null;
        } catch (error) {
            return error instanceof Error ? error : new Error(String(error));
        }
    })();
    const ready = async (): Promise<void> => {
        const refused = await refusal;
        if (refused !== null) {
            throw refused;
        }
    };
    const containers = new RunContainers((request) => new TestcontainersAdapter(request), ready);
    const served = await serveContainers(containers);
    project.provide('serviceContainers', served.url);
    return async () => {
        await served.close();
        await containers.stop();
    };
}
