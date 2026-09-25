import { loadPeer } from '../peer.js';
import { sweepOrphans } from './orphans.js';
import { RunContainers, serveContainers } from './run-containers.js';
import { SERVICE_IMAGES } from './service-images.js';
import { TestcontainersAdapter } from './testcontainers.js';

/**
 * The global setup of a project whose specs declare services: the project's
 * containers, served to its workers — vitest runs one per project, so two
 * projects of one run hold two sets.
 *
 * Before the first file it serves an empty {@link RunContainers} and provides
 * its address; in the background it reaches Docker and pulls each default
 * image the daemon lacks, so the first file waits on a pull at most once. A
 * container is started by the first file that declares it and shared by every
 * file of the project after; when the run closes, it stops them all. A project that
 * declares no service never asks, so it needs no Docker.
 */

/** What every declared service is answered when no container runtime is reachable. */
export const DOCKER_ABSENT =
    'declared services need Docker, and no Docker daemon answered — start Docker (Docker Desktop, OrbStack, colima…) and run again';

/**
 * Reach the container runtime, then remove the containers dead sessions left
 * behind and pull each default image it lacks.
 * Unreachable is the one refusal: {@link DOCKER_ABSENT}, with the runtime's
 * own reason after it.
 */
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

/** What the setup reads of its project: the channel to its workers. */
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
