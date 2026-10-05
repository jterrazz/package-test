import { execSync, spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createServer, Socket } from 'node:net';
import { resolve as resolvePath } from 'node:path';

import { pause } from '../../chain/pause.js';
import { invariant, refusal } from '../../chain/refusals/refusal.js';
import {
    groupEnded,
    KILL_GRACE_MS,
    reaped,
    signalGroup,
    SIGNALS_GROUPS,
    WATCHDOG,
} from './process-group.js';
import type { ProcessOptions } from './process.adapter.js';

const DEFAULT_READY_TIMEOUT = 30_000;
const READY_POLL_INTERVAL_MS = 250;

// Stryker disable all: the watchdog acts only when this process dies before stop(), which no test inside this process can observe; process-group's script is what it runs
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
// Stryker restore all

export function runToCompletion(command: string, env: NodeJS.ProcessEnv): void {
    // Stryker disable next-line StringLiteral: an empty stdio reads as the default, piped
    execSync(command, { env, stdio: 'pipe' });
}

// Stryker disable all: a server listening on port 0 always answers the port it got, and never errors
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
// Stryker restore all

/** Any HTTP status counts as ready. The child runs in its own process group so `stop()` kills a `next start` grandchild too, and a watchdog kills that group when the run dies before `stop()`. */
export class ServedProcess {
    port: null | number = null;
    private child: ChildProcess | null = null;
    private readonly extraEnv: Record<string, string>;
    private readonly specification: string;
    private readonly options: ProcessOptions;
    // Stryker disable next-line BooleanLiteral: spawnServer sets it before any read
    private exited = false;
    private output = '';
    private readonly root: string;
    private watchdog: ChildProcess | null = null;

    constructor(
        options: ProcessOptions,
        root: string,
        specification = 'website',
        extraEnv: Record<string, string> = {},
    ) {
        this.extraEnv = extraEnv;
        this.specification = specification;
        this.options = options;
        this.root = root;
    }

    async start(): Promise<string> {
        this.runBefore();
        const banner = this.options.ready instanceof RegExp ? this.options.ready : null;
        // invariant: banner mode: the server picks and announces the port, nothing is injected as `PORT`.
        const port = banner ? null : (this.options.port ?? (await findFreePort()));
        this.spawnServer(port);
        const deadline = Date.now() + this.timeout();
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
            detached: SIGNALS_GROUPS,
            env: {
                ...process.env,
                // Stryker disable next-line ConditionalExpression,EqualityOperator,StringLiteral: an env written as a function, which the specification reads into extraEnv, spreads to nothing either way
                ...(typeof this.options.env === 'function' ? {} : this.options.env),
                ...this.extraEnv,
                ...(port === null ? {} : { PORT: String(port) }),
            },
            shell: true,
            // Stryker disable next-line ArrayDeclaration: no server reads its input, ignored or piped
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        this.child = child;
        this.exited = false;
        // Stryker disable next-line ConditionalExpression,LogicalOperator,BlockStatement,EqualityOperator: see watchGroup
        if (child.pid !== undefined && SIGNALS_GROUPS) {
            this.watchdog = watchGroup(child.pid);
        }
        const collect = (data: unknown): void => {
            this.output += String(data);
        };
        // Stryker disable next-line OptionalChaining: piped, the stream is always there
        child.stdout?.on('data', collect);
        // Stryker disable next-line OptionalChaining: piped, the stream is always there
        child.stderr?.on('data', collect);
        child.on('close', () => {
            this.exited = true;
        });
        // invariant: a spawn that fails, its folder missing, says why before it closes.
        child.on('error', (error) => {
            collect(`${String(error)}\n`);
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
            // Stryker disable next-line EqualityOperator: the deadline is not met to the millisecond
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
        // Stryker disable next-line StringLiteral: a URL with no path asks for the root all the same
        const readyUrl = `${baseUrl}${typeof this.options.ready === 'string' ? this.options.ready : '/'}`;
        while (!this.exited) {
            if (await answers(readyUrl)) {
                this.port = port;
                return baseUrl;
            }
            // Stryker disable next-line EqualityOperator: the deadline is not met to the millisecond
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
                found: `specification.${this.specification}(): ${reason.found}.\nCommand: ${this.options.command}\nOutput:\n${this.output}`,
                read: 'docs/reference/services.md#process--the-one-shape-an-external-process-takes',
                why: reason.why,
            }),
        );
    }

    private workingDirectory(): string {
        // Stryker disable next-line StringLiteral: an empty path resolves to the root as `.` does
        return resolvePath(this.root, this.options.cwd ?? '.');
    }

    /** Must exit 0: a failed build is reported as such, not as a later missing file. */
    private runBefore(): void {
        const { before } = this.options;
        if (before === undefined) {
            return;
        }
        const outcome = spawnSync(before, [], {
            cwd: this.workingDirectory(),
            // Stryker disable next-line StringLiteral: output read as a Buffer joins into the same text
            encoding: 'utf8',
            shell: true,
        });
        if (outcome.status !== 0) {
            throw new Error(
                refusal({
                    fix: 'run the command by hand and correct what its output names',
                    found: `specification.${this.specification}(): \`before\` exited ${outcome.status ?? 'without a status'}.\nCommand: ${before}\nOutput:\n${outcome.stdout + outcome.stderr}`,
                    read: 'docs/reference/services.md#process--the-one-shape-an-external-process-takes',
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
        // Stryker disable next-line OptionalChaining: see watchGroup
        this.watchdog?.kill('SIGKILL');
        this.watchdog = null;

        await endGroup(child);
    }
}

// Stryker disable BlockStatement: a catch emptied answers undefined, which reads as no answer all the same
async function answers(url: string): Promise<boolean> {
    try {
        await fetch(url, { redirect: 'manual' });
        return true;
    } catch {
        return false;
    }
}
// Stryker restore BlockStatement

/** The group gets SIGTERM, and SIGKILL when it outlives the grace: its leader alive or not, its strays die with it. */
async function endGroup(child: ChildProcess): Promise<void> {
    // Stryker disable next-line all: a group read from no pid is this very process's, and a mutant of this guard would wait on the run measuring it
    if (child.pid === undefined) {
        return;
    }
    const leaderReaped = reaped(child);
    signalGroup(child, 'SIGTERM');
    if (!(await groupEnded(-child.pid, KILL_GRACE_MS))) {
        signalGroup(child, 'SIGKILL');
    }
    // hazard: macOS skips an exiting process when it signals a group, so the group reads as gone while the leader still holds its port open; its reaping is what proves the port closed.
    await leaderReaped;
}
