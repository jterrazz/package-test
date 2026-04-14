import { execSync } from 'node:child_process';

import { JsonAccessor } from '../../result/json.js';
import type { FileAccessor } from '../../result/result.js';
import { StreamAccessor } from '../../result/stream.js';
import type { CommandResult } from './command.port.js';
import { CliResult } from './result.js';

const EXEC_TIMEOUT = 10_000;

function readInspectState(inspect: any): { running: boolean; status: string } {
    const state = inspect?.State ?? inspect?.state;
    if (!state) {
        return { running: false, status: 'unknown' };
    }
    return {
        running: Boolean(state.Running ?? state.running ?? false),
        status: String(state.Status ?? state.status ?? 'unknown'),
    };
}

/**
 * Assertion accessor for a single Docker container captured by the docker()
 * spec mode. Mirrors the shape of {@link CliResult} so tests use the same
 * vocabulary (`stdout.toContain`, `file(...).content`, etc.) regardless of
 * where output came from.
 *
 * Sync state (`exists`, `running`, `status`) is derived from the `docker
 * inspect` payload captured at result-construction time. Logs are fetched
 * lazily on first access to `stdout`/`stderr`.
 */
export class ContainerAccessor {
    private cachedLogs: null | string = null;
    private readonly containerId: null | string;
    readonly exists: boolean;
    private readonly inspectData: unknown;
    readonly running: boolean;
    readonly status: string;
    private readonly testDir: string;
    private readonly transform?: (text: string) => string;

    constructor(
        containerId: null | string,
        inspectData: unknown,
        testDir: string,
        transform?: (text: string) => string,
    ) {
        this.containerId = containerId;
        this.inspectData = inspectData;
        this.testDir = testDir;
        this.transform = transform;
        this.exists = containerId !== null;
        if (this.exists) {
            const state = readInspectState(inspectData);
            this.running = state.running;
            this.status = state.status;
        } else {
            this.running = false;
            this.status = 'absent';
        }
    }

    /**
     * Raw `docker inspect` object for this container. Throws if the container
     * was not captured (i.e. `.exists === false`).
     */
    get inspect(): JsonAccessor {
        this.requireExists('inspect');
        return new JsonAccessor(JSON.stringify(this.inspectData), this.testDir, this.transform);
    }

    /** Captured logs (stdout+stderr combined for v1). */
    get stdout(): StreamAccessor {
        this.requireExists('stdout');
        return new StreamAccessor(this.loadLogs(), 'stdout', this.testDir, this.transform);
    }

    /** Captured logs (stdout+stderr combined for v1). */
    get stderr(): StreamAccessor {
        this.requireExists('stderr');
        return new StreamAccessor(this.loadLogs(), 'stderr', this.testDir, this.transform);
    }

    /**
     * Read a file from inside the container via `docker exec cat`. The
     * returned object satisfies the same {@link FileAccessor} shape used by
     * the host filesystem accessor, so tests do not need to learn a new API.
     */
    file(path: string): FileAccessor {
        this.requireExists('file');
        const id = this.containerId!;
        const exists = this.containerExec(id, ['test', '-e', path]).exitCode === 0;
        return {
            get content(): string {
                if (!exists) {
                    throw new Error(`File not found in container: ${path}`);
                }
                const result = execSync(`docker exec ${id} cat ${JSON.stringify(path)}`, {
                    encoding: 'utf8',
                    timeout: EXEC_TIMEOUT,
                });
                return result;
            },
            exists,
        };
    }

    /**
     * Run a shell command inside the container and get back the same
     * {@link CliResult} used for host-side executions.
     */
    async exec(cmd: string): Promise<CliResult> {
        this.requireExists('exec');
        const commandResult = this.containerExec(this.containerId!, ['sh', '-c', cmd]);
        return new CliResult({
            commandResult,
            config: {},
            testDir: this.testDir,
            transform: this.transform,
            workDir: this.testDir,
        });
    }

    private requireExists(member: string): void {
        if (!this.exists) {
            throw new Error(
                `ContainerAccessor.${member}: container does not exist (check .exists first)`,
            );
        }
    }

    private loadLogs(): string {
        if (this.cachedLogs !== null) {
            return this.cachedLogs;
        }
        try {
            const out = execSync(`docker logs ${this.containerId}`, {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: EXEC_TIMEOUT,
            });
            this.cachedLogs = out;
        } catch (error: any) {
            // Fall back to whatever the CLI managed to write before exiting
            // (docker logs may fail if the container disappeared mid-run).
            this.cachedLogs =
                typeof error?.stdout === 'string' ? error.stdout : String(error?.stderr ?? '');
        }
        return this.cachedLogs ?? '';
    }

    private containerExec(id: string, argv: string[]): CommandResult {
        // Piping stdio keeps a non-zero exit inside a CommandResult instead of throwing out.
        try {
            const quoted = argv.map((a) => JSON.stringify(a)).join(' ');
            const stdout = execSync(`docker exec ${id} ${quoted}`, {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: EXEC_TIMEOUT,
            });
            return { exitCode: 0, stderr: '', stdout };
        } catch (error: any) {
            return {
                exitCode: typeof error?.status === 'number' ? error.status : 1,
                stderr:
                    typeof error?.stderr === 'string' ? error.stderr : String(error?.message ?? ''),
                stdout: typeof error?.stdout === 'string' ? error.stdout : '',
            };
        }
    }
}
