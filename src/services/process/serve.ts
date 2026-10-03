import { execSync, spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createServer, Socket } from 'node:net';
import { resolve as resolvePath } from 'node:path';

import { pause } from '../../chain/pause.js';
import { invariant, refusal } from '../../chain/refusals/refusal.js';
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
    private exited = false;
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
        // invariant: banner mode: the server picks and announces the port, nothing is injected as `PORT`.
        const port = banner ? null : (this.options.port ?? (await findFreePort()));
        this.spawnServer(port);
        const deadline = Date.now() + (this.options.timeout ?? DEFAULT_READY_TIMEOUT);
        const url = banner
            ? await this.awaitBanner(banner, deadline)
            : await this.awaitAnswer(port ?? 0, deadline);

        return (
            url ??
            (await this.refuse({
                fix: 'run the command by hand and correct what its output names',
                found: 'the server command exited before it was ready',
                why: 'A process is handed to the chain once it is ready, and one that exits never is.',
            }))
        );
    }

    private spawnServer(port: null | number): void {
        const child = spawn(this.options.command, [], {
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
        this.child = child;
        this.exited = false;
        if (child.pid !== undefined && process.platform !== 'win32') {
            this.watchdog = watchGroup(child.pid);
        }
        const collect = (data: unknown): void => {
            this.output += String(data);
        };
        child.stdout?.on('data', collect);
        child.stderr?.on('data', collect);
        child.on('close', () => {
            this.exited = true;
        });
    }

    private async awaitBanner(banner: RegExp, deadline: number): Promise<null | string> {
        while (!this.exited) {
            // hazard: a `g`-flagged pattern would carry lastIndex across polls.
            banner.lastIndex = 0;
            const found = banner.exec(this.output);
            if (found) {
                return await this.bannerPort(banner, found[1]);
            }
            if (Date.now() >= deadline) {
                return await this.refuse({
                    fix: 'correct the pattern to what the server prints, or raise `timeout`',
                    found: `the server did not print ${String(banner)} within ${this.timeout()}ms`,
                    why: 'A process is ready once its output matches `ready`, within `timeout`.',
                });
            }
            await pause(READY_POLL_INTERVAL_MS);
        }
        return null;
    }

    private async bannerPort(banner: RegExp, group: string | undefined): Promise<string> {
        const captured = Number(group);
        if (!Number.isInteger(captured)) {
            return await this.refuse({
                fix: 'capture the port alone in the pattern’s one group, e.g. /listening on (\\d+)/',
                found: `the ready pattern ${String(banner)} matched, and its capture group is not a port ("${group}")`,
                why: 'A RegExp `ready` is read over the output, and its one capture group is the port.',
            });
        }
        this.port = captured;
        return `http://127.0.0.1:${captured}`;
    }

    private async awaitAnswer(port: number, deadline: number): Promise<null | string> {
        const baseUrl = `http://127.0.0.1:${port}`;
        const readyUrl = `${baseUrl}${typeof this.options.ready === 'string' ? this.options.ready : '/'}`;
        while (!this.exited) {
            if (await answers(readyUrl)) {
                this.port = port;
                return baseUrl;
            }
            if (Date.now() >= deadline) {
                return await this.refuse({
                    fix: 'correct `ready` to a path the server answers, have it listen on `PORT`, or raise `timeout`',
                    found: `the server did not answer on ${readyUrl} within ${this.timeout()}ms`,
                    why: 'A process is ready once its `ready` path answers, within `timeout`.',
                });
            }
            await pause(READY_POLL_INTERVAL_MS);
        }
        return null;
    }

    private timeout(): number {
        return this.options.timeout ?? DEFAULT_READY_TIMEOUT;
    }

    private async refuse(reason: { fix: string; found: string; why: string }): Promise<never> {
        await this.stop();
        throw new Error(
            refusal({
                fix: reason.fix,
                found: `specification.${this.facet}(): ${reason.found}.\nCommand: ${this.options.command}\nOutput:\n${this.output}`,
                read: 'docs/18-services.md#process--the-one-shape-an-external-process-takes',
                why: reason.why,
            }),
        );
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
                    read: 'docs/18-services.md#process--the-one-shape-an-external-process-takes',
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
                void endLeaderlessGroup(child).then(resolve);
                return;
            }
            killGroup(child, 'SIGTERM');
            const killTimer = setTimeout(() => {
                if (!exited) {
                    killGroup(child, 'SIGKILL');
                    resolve();
                }
            }, KILL_GRACE_MS);
            killTimer.unref?.();
        });
    }
}

function killGroup(child: ChildProcess, signal: NodeJS.Signals): void {
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

async function answers(url: string): Promise<boolean> {
    try {
        await fetch(url, { redirect: 'manual' });
        return true;
    } catch {
        return false;
    }
}

async function endLeaderlessGroup(child: ChildProcess): Promise<void> {
    if (child.pid === undefined || process.platform === 'win32') {
        return;
    }
    killGroup(child, 'SIGTERM');
    if (!(await groupEnded(-child.pid, KILL_GRACE_MS))) {
        killGroup(child, 'SIGKILL');
    }
}
