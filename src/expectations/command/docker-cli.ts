import { execSync } from 'node:child_process';

import type { CliOutput } from './cli.result.js';

const DEFAULT_TIMEOUT = 10_000;

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

export function inspectContainer(id: string): unknown {
    const raw = execSync(`docker inspect ${id}`, {
        encoding: 'utf8',
        timeout: DEFAULT_TIMEOUT,
    });
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed[0] : parsed;
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
        // Ignore — containers may already be gone.
    }
}

export function containerLogs(id: string): string {
    try {
        return execSync(`docker logs ${id}`, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: DEFAULT_TIMEOUT,
        });
    } catch (error: any) {
        return typeof error?.stdout === 'string'
            ? String(error.stdout)
            : String(error?.stderr ?? '');
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
    } catch (error: any) {
        return {
            exitCode: typeof error?.status === 'number' ? error.status : 1,
            stderr: typeof error?.stderr === 'string' ? error.stderr : String(error?.message ?? ''),
            stdout: typeof error?.stdout === 'string' ? error.stdout : '',
        };
    }
}
