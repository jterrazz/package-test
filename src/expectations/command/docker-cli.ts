import { execSync } from 'node:child_process';

import type { CliOutput } from './cli.result.js';

/**
 * The one module that runs the `docker` CLI — the lookups the docker() spec
 * mode makes, and the reads a container accessor makes of one container. Every
 * call shares one timeout and one encoding. Sync is deliberate — the calls are fast, run only on the host, and
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

/** The combined logs of a container, or what the CLI printed before it failed (the container may be gone). */
export function containerLogs(id: string): string {
    try {
        return execSync(`docker logs ${id}`, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: DEFAULT_TIMEOUT,
        });
    } catch (error: any) {
        return typeof error?.stdout === 'string' ? error.stdout : String(error?.stderr ?? '');
    }
}

/** A file's content inside a container, read by `docker exec … cat`; throws when it cannot be read. */
export function readContainerFile(id: string, path: string): string {
    return execSync(`docker exec ${id} cat ${JSON.stringify(path)}`, {
        encoding: 'utf8',
        timeout: DEFAULT_TIMEOUT,
    });
}

/** Run `argv` inside a container. Piping stdio keeps a non-zero exit inside the output instead of throwing out. */
export function execInContainer(id: string, argv: readonly string[]): CliOutput {
    try {
        const quoted = argv.map((a) => JSON.stringify(a)).join(' ');
        const stdout = execSync(`docker exec ${id} ${quoted}`, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: DEFAULT_TIMEOUT,
        });
        return { exitCode: 0, stderr: '', stdout };
    } catch (error: any) {
        return {
            exitCode: typeof error?.status === 'number' ? error.status : 1,
            stderr: typeof error?.stderr === 'string' ? error.stderr : String(error?.message ?? ''),
            stdout: typeof error?.stdout === 'string' ? error.stdout : '',
        };
    }
}
