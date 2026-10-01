import { execSync, spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createServer, Socket } from 'node:net';
import { resolve as resolvePath } from 'node:path';

import { invariant, refusal } from '../../../lint/refusal.js';
import { pause } from '../../chain/pause.js';
import { groupEnded, KILL_GRACE_MS, WATCHDOG } from './process-group.js';
import type { ProcessOptions } from './process.adapter.js';

const DEFAULT_READY_TIMEOUT = 30_000;
const READY_POLL_INTERVAL_MS = 250;
function watchGroup(groupId: number): ChildProcess {
    const watchdog = spawn(process.execPath, ['-e', WATCHDOG, String(groupId)], {
        detached: true,
        env: { ...process.env, NODE_OPTIONS: undefined },
        stdio: ['pipe', 'ignore', 'ignore'],
    });
    watchdog.on('error', () => {
        watchdog.stdin?.destroy();
    });
    watchdog.unref();
    if (watchdog.stdin instanceof Socket) {
        watchdog.stdin.unref();
    }
    return watchdog;
}

export function runToCompletion(command: string, env: NodeJS.ProcessEnv): void {
    execSync(command, { env, stdio: 'pipe' });
}

async function findFreePort(): Promise<number> {
    return await new Promise((resolve, reject) => {
        const server = createServer();
        server.listen(0, () => {
            const address = server.address();
            if (address === null || typeof address === 'string') {
                server.close();
                reject(invariant('a server listening on port 0 answered no port'));
                return;
            }
            const { port } = address;
            server.close(() => {
                resolve(port);
            });
        });
        server.on('error', reject);
    });
}

/** Any HTTP status counts as ready. The child runs in its own process group so `stop()` kills a `next start` grandchild too, and a watchdog kills that group when the run dies before `stop()`. */
export class ServedProcess {
    port: null | number = null;
    private child: ChildProcess | null = null;
    private readonly extraEnv: Record<string, string>;
    private readonly facet: string;
    private readonly options: ProcessOptions;
    private output = '';
    private readonly root: string;
    private watchdog: ChildProcess | null = null;

    constructor(
        options: ProcessOptions,
        root: string,
        facet = 'website',
        extraEnv: Record<string, string> = {},
    ) {
        this.extraEnv = extraEnv;
        this.facet = facet;
        this.options = options;
        this.root = root;
    }

    async start(): Promise<string> {
        this.runBefore();
        const banner = this.options.ready instanceof RegExp ? this.options.ready : null;
        // Banner mode: the server picks and announces the port, nothing is injected as `PORT`.
        const port = banner ? null : (this.options.port ?? (await findFreePort()));
        const timeout = this.options.timeout ?? DEFAULT_READY_TIMEOUT;

        this.child = spawn(this.options.command, [], {
            cwd: this.workingDirectory(),
            detached: process.platform !== 'win32',
            env: {
                ...process.env,
                ...(typeof this.options.env === 'function' ? {} : this.options.env),
                ...this.extraEnv,
                ...(port === null ? {} : { PORT: String(port) }),
            },
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        if (this.child.pid !== undefined && process.platform !== 'win32') {
            this.watchdog = watchGroup(this.child.pid);
        }
        this.child.stdout?.on('data', (data) => {
            this.output += data.toString();
        });
        this.child.stderr?.on('data', (data) => {
            this.output += data.toString();
        });

        let exited = false;
        this.child.on('close', () => {
            exited = true;
        });

        const deadline = Date.now() + timeout;
        const died = async (): Promise<never> => {
            await this.stop();
            throw new Error(
                refusal({
                    fix: 'run the command by hand and correct what its output names',
                    found: `specification.${this.facet}(): the server command exited before it was ready.\nCommand: ${this.options.command}\nOutput:\n${this.output}`,
                    read: 'docs/17-services.md#process--the-one-shape-an-external-process-takes',
                    why: 'A process is handed to the chain once it is ready, and one that exits never is.',
                }),
            );
        };

        if (banner) {
            for (;;) {
                // A `g`-flagged pattern would carry lastIndex across polls.
                banner.lastIndex = 0;
                const found = banner.exec(this.output);
                if (found) {
                    const captured = Number(found[1]);
                    if (!Number.isInteger(captured)) {
                        await this.stop();
                        throw new Error(
                            refusal({
                                fix: 'capture the port alone in the pattern’s one group, e.g. /listening on (\\d+)/',
                                found: `specification.${this.facet}(): the ready pattern ${String(banner)} matched, and its capture group is not a port ("${found[1]}").\nCommand: ${this.options.command}\nOutput:\n${this.output}`,
                                read: 'docs/17-services.md#process--the-one-shape-an-external-process-takes',
                                why: 'A RegExp `ready` is read over the output, and its one capture group is the port.',
                            }),
                        );
                    }
                    this.port = captured;
                    return `http://127.0.0.1:${captured}`;
                }
                if (exited) {
                    break;
                }
                if (Date.now() >= deadline) {
                    await this.stop();
                    throw new Error(
                        refusal({
                            fix: 'correct the pattern to what the server prints, or raise `timeout`',
                            found: `specification.${this.facet}(): the server did not print ${String(banner)} within ${timeout}ms.\nCommand: ${this.options.command}\nOutput:\n${this.output}`,
                            read: 'docs/17-services.md#process--the-one-shape-an-external-process-takes',
                            why: 'A process is ready once its output matches `ready`, within `timeout`.',
                        }),
                    );
                }
                await pause(READY_POLL_INTERVAL_MS);
            }
            return await died();
        }

        const baseUrl = `http://127.0.0.1:${port}`;
        const readyUrl = `${baseUrl}${this.options.ready ?? '/'}`;
        for (;;) {
            if (exited) {
                break;
            }
            try {
                await fetch(readyUrl, { redirect: 'manual' });
                this.port = port;
                return baseUrl;
            } catch {
                if (Date.now() >= deadline) {
                    await this.stop();
                    throw new Error(
                        refusal({
                            fix: 'correct `ready` to a path the server answers, have it listen on `PORT`, or raise `timeout`',
                            found: `specification.${this.facet}(): the server did not answer on ${readyUrl} within ${timeout}ms.\nCommand: ${this.options.command}\nOutput:\n${this.output}`,
                            read: 'docs/17-services.md#process--the-one-shape-an-external-process-takes',
                            why: 'A process is ready once its `ready` path answers, within `timeout`.',
                        }),
                    );
                }
                await pause(READY_POLL_INTERVAL_MS);
            }
        }
        return await died();
    }

    private workingDirectory(): string {
        return this.options.cwd === undefined
            ? this.root
            : resolvePath(this.root, this.options.cwd);
    }

    /** Must exit 0: a failed build is reported as such, not as a later missing file. */
    private runBefore(): void {
        const { before } = this.options;
        if (before === undefined) {
            return;
        }
        const outcome = spawnSync(before, [], {
            cwd: this.workingDirectory(),
            encoding: 'utf8',
            shell: true,
        });
        if (outcome.status !== 0) {
            throw new Error(
                refusal({
                    fix: 'run the command by hand and correct what its output names',
                    found: `specification.${this.facet}(): \`before\` exited ${outcome.status ?? 'without a status'}.\nCommand: ${before}\nOutput:\n${(outcome.stdout ?? '') + (outcome.stderr ?? '')}`,
                    read: 'docs/17-services.md#process--the-one-shape-an-external-process-takes',
                    why: 'A process’s `before` must exit 0 before the process starts.',
                }),
            );
        }
    }

    async stop(): Promise<void> {
        const { child } = this;
        if (!child) {
            return;
        }
        this.child = null;
        this.watchdog?.kill('SIGKILL');
        this.watchdog = null;

        await new Promise<void>((resolve) => {
            let exited = false;
            child.on('exit', () => {
                exited = true;
                resolve();
            });
            if (child.exitCode !== null || child.signalCode !== null) {
                void this.endLeaderlessGroup(child).then(resolve);
                return;
            }
            this.kill(child, 'SIGTERM');
            const killTimer = setTimeout(() => {
                if (!exited) {
                    this.kill(child, 'SIGKILL');
                    resolve();
                }
            }, KILL_GRACE_MS);
            killTimer.unref?.();
        });
    }

    private async endLeaderlessGroup(child: ChildProcess): Promise<void> {
        if (child.pid === undefined || process.platform === 'win32') {
            return;
        }
        const group = -child.pid;
        this.kill(child, 'SIGTERM');
        if (!(await groupEnded(group, KILL_GRACE_MS))) {
            this.kill(child, 'SIGKILL');
        }
    }

    private kill(child: ChildProcess, signal: NodeJS.Signals): void {
        if (child.pid !== undefined && process.platform !== 'win32') {
            try {
                process.kill(-child.pid, signal);
                return;
            } catch {
                child.kill(signal);
                return;
            }
        }
        child.kill(signal);
    }
}
