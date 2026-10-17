import { execSync } from 'node:child_process';

import { refusal } from '../../chain/refusals/refusal.js';
import type { CliOutput } from './cli.result.js';

const DEFAULT_TIMEOUT = 10_000;

/** Docker-aware mode reads what the daemon answers: a run where none answers is refused, never passed. */
export function requireDockerDaemon(): void {
    try {
        execSync('docker version --format "{{.Server.Version}}"', {
            stdio: 'ignore',
            timeout: DEFAULT_TIMEOUT,
        });
    } catch (error) {
        throw new Error(
            refusal({
                fix: 'start Docker (Docker Desktop, OrbStack, colima…) and run again',
                found: 'specification.cli({ docker }) asked for Docker, and no Docker daemon answered',
                read: 'docs/guides/cli-specs.md#docker-aware-mode',
                why: 'Docker-aware mode reads the containers a run spawned, so it needs a Docker daemon.',
            }),
            { cause: error },
        );
    }
}

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

/** A field of a value read off docker's JSON or a failed process: absent wherever the value does not hold it. */
export function fieldOf(value: unknown, ...keys: readonly string[]): unknown {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }
    const key = keys.find((candidate) => candidate in value);
    return key === undefined ? undefined : Reflect.get(value, key);
}

const streamOf = (error: unknown, key: 'stderr' | 'stdout'): string | undefined => {
    const stream = fieldOf(error, key);
    return typeof stream === 'string' ? stream : undefined;
};

export function inspectContainer(id: string): unknown {
    const raw = execSync(`docker inspect ${id}`, {
        encoding: 'utf8',
        timeout: DEFAULT_TIMEOUT,
    });
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
        return parsed;
    }
    const inspected: unknown[] = parsed;
    return inspected[0];
}

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
        // invariant: ignore: containers may already be gone.
    }
}

export function containerLogs(id: string): string {
    try {
        return execSync(`docker logs ${id}`, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: DEFAULT_TIMEOUT,
        });
    } catch (error) {
        return streamOf(error, 'stdout') ?? streamOf(error, 'stderr') ?? '';
    }
}

export function readContainerFile(id: string, path: string): string {
    return execSync(`docker exec ${id} cat ${JSON.stringify(path)}`, {
        encoding: 'utf8',
        timeout: DEFAULT_TIMEOUT,
    });
}

export function execInContainer(id: string, argv: readonly string[]): CliOutput {
    try {
        const quoted = argv.map((a) => JSON.stringify(a)).join(' ');
        const stdout = execSync(`docker exec ${id} ${quoted}`, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: DEFAULT_TIMEOUT,
        });
        return { exitCode: 0, stderr: '', stdout };
    } catch (error) {
        const status = fieldOf(error, 'status');
        return {
            exitCode: typeof status === 'number' ? status : 1,
            stderr: streamOf(error, 'stderr') ?? (error instanceof Error ? error.message : ''),
            stdout: streamOf(error, 'stdout') ?? '',
        };
    }
}
