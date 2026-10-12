import { execSync, spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { Socket } from 'node:net';
import { resolve as resolvePath } from 'node:path';

import { pause } from '../../chain/pause.js';
import { refusal } from '../../chain/refusals/refusal.js';
import { findFreePort, firstAnswering } from './listening.js';
import { lessonOf } from './port-in-use.js';
import type { Lesson } from './port-in-use.js';
import {
    groupEnded,
    KILL_GRACE_MS,
    reaped,
    REAPER,
    signalGroup,
    SIGNALS_GROUPS,
    WATCHDOG,
} from './process-group.js';
import type { Strays } from './process-group.js';
import type { ProcessOptions } from './process.adapter.js';

const DEFAULT_READY_TIMEOUT = 30_000;
const READY_POLL_INTERVAL_MS = 250;

// Stryker disable ArrayDeclaration,BlockStatement,BooleanLiteral,CallExpression,ConditionalExpression,ObjectLiteral,OptionalChaining,StringLiteral: the watchdog acts only when this process dies before stop(), which no test inside this process can observe; process-group's script is what it runs
function watchGroup(groupId: number, strays: Strays): ChildProcess {
    const args = ['-e', WATCHDOG, JSON.stringify(strays), String(groupId)];
    const watchdog = spawn(process.execPath, args, {
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

async function reapStrays(strays: Strays): Promise<void> {
    const args = ['-e', REAPER, JSON.stringify(strays)];
    // Stryker disable next-line ConditionalExpression,EqualityOperator,ObjectLiteral,StringLiteral: a reaper handed no strays reaps nothing, and its output is read by no one
    await (strays.length > 0 ? reaped(spawn(process.execPath, args, { stdio: 'ignore' })) : null);
}

export function runToCompletion(command: string, env: NodeJS.ProcessEnv): void {
    // Stryker disable next-line StringLiteral: an empty stdio reads as the default, piped
    execSync(command, { env, stdio: 'pipe' });
}

/** Any HTTP status counts as ready. The child runs in its own process group so `stop()` kills a `next start` grandchild too, and a watchdog kills that group when the run dies before `stop()`; both reap the strays it declares, the processes it spawns outside its group. */
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
    private readonly strays: Strays;
    private watchdog: ChildProcess | null = null;

    constructor(
        options: ProcessOptions & { strays?: Strays },
        root: string,
        specification = 'website',
        extraEnv: Record<string, string> = {},
    ) {
        this.extraEnv = extraEnv;
        // Stryker disable next-line ArrayDeclaration: a stray of no shape is no process, and the reaper reaps nothing for it
        this.strays = options.strays ?? [];
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

    // invariant: `before` and the server read one environment, the declared `env` included; the server's carries its port beside it.
    private environment(port: null | number): NodeJS.ProcessEnv {
        return {
            ...process.env,
            // hazard: Astro 7 detaches `astro preview` and `astro dev` under an agent — the command exits 0 and the server outlives the run — unless it is told to stay attached.
            ASTRO_DEV_BACKGROUND: '1',
            ASTRO_PREVIEW_BACKGROUND: '1',
            // Stryker disable next-line ConditionalExpression,EqualityOperator,StringLiteral: an env written as a function, which the specification reads into extraEnv, spreads to nothing either way
            ...(typeof this.options.env === 'function' ? {} : this.options.env),
            ...this.extraEnv,
            ...(port === null ? {} : { PORT: String(port) }),
        };
    }

    private spawnServer(port: null | number): void {
        const child = spawn(this.options.command, [], {
            cwd: this.workingDirectory(),
            detached: SIGNALS_GROUPS,
            env: this.environment(port),
            shell: true,
            // Stryker disable next-line ArrayDeclaration: no server reads its input, ignored or piped
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        this.child = child;
        this.exited = false;
        // Stryker disable next-line ConditionalExpression,LogicalOperator,BlockStatement,EqualityOperator: see watchGroup
        if (child.pid !== undefined && SIGNALS_GROUPS) {
            this.watchdog = watchGroup(child.pid, this.strays);
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
        // invariant: a server may listen on either family (Astro listens on ::1), so both are asked, and the one that answers is the site's address.
        const baseUrls = [`http://127.0.0.1:${port}`, `http://[::1]:${port}`];
        // Stryker disable next-line StringLiteral: a URL with no path asks for the root all the same
        const path = typeof this.options.ready === 'string' ? this.options.ready : '/';
        while (!this.exited) {
            const answering = await firstAnswering(baseUrls.map((baseUrl) => `${baseUrl}${path}`));
            if (answering !== undefined) {
                this.port = port;
                return answering.slice(0, answering.length - path.length);
            }
            // Stryker disable next-line EqualityOperator: the deadline is not met to the millisecond
            if (Date.now() >= deadline) {
                return await this.refuse({
                    fix: 'correct `ready` to a path the server answers, have it listen on `PORT`, or raise `timeout`',
                    found: `the server did not answer on ${baseUrls.map((baseUrl) => `${baseUrl}${path}`).join(' or ')} within ${this.timeout()}ms, whatever address it printed above`,
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

    private async refuse(reason: Lesson): Promise<never> {
        await this.stop();
        const lesson = lessonOf(reason, this.output, this.options.port);
        throw new Error(
            refusal({
                fix: lesson.fix,
                found: `specification.${this.specification}(): ${lesson.found}.\nCommand: ${this.options.command}\nOutput:\n${this.output}`,
                read: 'docs/reference/services.md#process--the-one-shape-an-external-process-takes',
                why: lesson.why,
            }),
        );
    }

    private workingDirectory(): string {
        // Stryker disable next-line StringLiteral: an empty path resolves to the root as `.` does
        const { cwd = '.' } = this.options;
        // Stryker disable next-line StringLiteral: an empty path resolves to the root as `.` does
        return resolvePath(this.root, typeof cwd === 'function' ? cwd() : cwd);
    }

    /** Must exit 0: a failed build is reported as such, not as a later missing file. */
    private runBefore(): void {
        const { before } = this.options;
        if (before === undefined) {
            return;
        }
        const outcome = spawnSync(before, [], {
            cwd: this.workingDirectory(),
            env: this.environment(null),
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
        await endGroup(child);
        await reapStrays(this.strays);
        // hazard: the watchdog stands until the strays are gone: a run killed while it stops still reaps them.
        // Stryker disable next-line OptionalChaining: see watchGroup
        this.watchdog?.kill('SIGKILL');
        this.watchdog = null;
    }
}

// invariant: the group gets SIGTERM, and SIGKILL when it outlives the grace: its leader alive or not, its strays die with it.
async function endGroup(child: ChildProcess): Promise<void> {
    // Stryker disable next-line BlockStatement,ConditionalExpression,EqualityOperator: a group read from no pid is this very process's, and a mutant of this guard would wait on the run measuring it
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
