import { ContainerAccessor } from '../../../integrations/docker/container-accessor.js';
import { inspectContainer } from '../../../integrations/docker/docker-lookup.js';

/**
 * Build the `docker(containerId)` reader handed out by `specification.api()`
 * and `specification.cli()` — a lazy accessor over `docker inspect`.
 */
export function createDockerReader(testDir: string): (containerId: string) => ContainerAccessor {
    return (containerId: string): ContainerAccessor => {
        try {
            const inspect = inspectContainer(containerId);
            return new ContainerAccessor(containerId, inspect, testDir);
        } catch {
            return new ContainerAccessor(null, null, testDir);
        }
    };
}
