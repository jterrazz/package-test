import { execSync } from 'node:child_process';

/**
 * Thin synchronous wrappers around the `docker` CLI used by the docker() spec
 * mode. Sync is deliberate — the calls are fast, run only on the host, and
 * keep the dispose path straightforward (`Symbol.asyncDispose` can still be
 * async without needing these to be).
 */

const DEFAULT_TIMEOUT = 10_000;

/** Return all container IDs (running or stopped) that carry `key=value`. */
export function findContainersByLabel(key: string, value: string): string[] {
    try {
        const raw = execSync(`docker ps -aq -f label=${key}=${value}`, {
            encoding: 'utf8',
            timeout: DEFAULT_TIMEOUT,
        });
        return raw
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
    } catch {
        return [];
    }
}

/** Return the raw `docker inspect` payload (object, not array) for a container. */
export function inspectContainer(id: string): unknown {
    const raw = execSync(`docker inspect ${id}`, {
        encoding: 'utf8',
        timeout: DEFAULT_TIMEOUT,
    });
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed[0] : parsed;
}

/** Force-remove the given container IDs in a single call. Errors are swallowed. */
export function removeContainers(ids: string[]): void {
    if (ids.length === 0) {
        return;
    }
    try {
        execSync(`docker rm -f ${ids.join(' ')}`, {
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: DEFAULT_TIMEOUT,
        });
    } catch {
        // Ignore — containers may already be gone.
    }
}
