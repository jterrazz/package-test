import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve as resolvePath } from 'node:path';

/** Grace period between SIGTERM and the SIGKILL escalation. */
const KILL_GRACE_MS = 2000;
const DEFAULT_READY_TIMEOUT = 30_000;
const READY_POLL_INTERVAL_MS = 250;

/**
 * The ONE shape an external process takes — the site under test, a backend a
 * page talks to, a bundler a simulator loads from. Built by `process()`
 * (chapter 17) and accepted wherever a facet starts something outside this
 * process: `website({ server })`, `services: { api: process(…) }`, and the
 * literate `serve:` registry.
 */
export type ProcessOptions = {
    /**
     * A one-shot command run ONCE per specification, before the process is
     * spawned, which must exit 0 — a build, a migration, a fixture load. Its
     * failure is the specification's, and it says so.
     */
    before?: string;
    /** Shell command that starts the process. Receives the chosen port as `PORT`. */
    command: string;
    /** Working directory, relative to the project root. Default: the root itself. */
    cwd?: string;
    /**
     * Environment for the child, on top of the runner's own. A function
     * receives the services already started beside this one, so a process can
     * be handed a sibling's connection string.
     */
    env?:
        | ((services: Record<string, { connectionString: string }>) => Record<string, string>)
        | Record<string, string>;
    /** Fixed port. Default: an OS-assigned free port, injected as `PORT`. */
    port?: number;
    /**
     * How readiness is observed. Two forms:
     *
     * - a **path** (or nothing) — the framework picks the port, injects it as
     *   `PORT`, and polls `<baseUrl><path>` until it answers any HTTP status
     *   (default `/`). This is `specification.website()`'s form.
     * - a **regex over the child's output** with ONE capture group holding the
     *   port the server chose itself. Nothing is injected as `PORT`: the server
     *   announces its port and the framework reads it from the banner. This is
     *   the form a literate `serve:` registration uses.
     */
    ready?: RegExp | string;
    /** Readiness budget in milliseconds. Default 30 000. */
    timeout?: number;
};

const delay = async (ms: number): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, ms));
};

/** Ask the OS for a free TCP port. */
async function findFreePort(): Promise<number> {
    return await new Promise((resolve, reject) => {
        const server = createServer();
        server.listen(0, () => {
            const address = server.address();
            if (address === null || typeof address === 'string') {
                server.close();
                reject(new Error('could not determine a free port'));
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

/**
 * Starts the site under test as a child process and waits until it answers
 * HTTP. Any HTTP status counts as ready — a 404 on the ready path is still a
 * listening server; only connection failures keep the poll going.
 *
 * The child runs through the shell in its own process group (POSIX) so
 * `stop()` can terminate the whole tree — a `next start` grandchild must not
 * outlive the spec run (same escalation as the cli exec adapter: SIGTERM,
 * then SIGKILL after a 2 s grace).
 */
export class ServeAdapter {
    /** The port the server ended up on — known only after {@link start}. */
    port: null | number = null;
    private child: ChildProcess | null = null;
    /** Extra environment injected into the child (e.g. the stub backend URL). */
    private readonly extraEnv: Record<string, string>;
    /** The constructor named in error messages — `website`, or `mobile` (appium server). */
    private readonly facet: string;
    private readonly options: ProcessOptions;
    private output = '';
    private readonly root: string;

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

    /** Start the server and resolve with its base URL once it is ready. */
    async start(): Promise<string> {
        this.runBefore();
        const banner = this.options.ready instanceof RegExp ? this.options.ready : null;
        // Banner mode: the SERVER picks the port and announces it, so nothing
        // Is injected as PORT — the framework reads the capture group instead.
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
        this.child.stdout?.on('data', (data) => {
            this.output += data.toString();
        });
        this.child.stderr?.on('data', (data) => {
            this.output += data.toString();
        });

        let exited = false;
        this.child.on('exit', () => {
            exited = true;
        });

        const deadline = Date.now() + timeout;
        const died = (): never => {
            throw new Error(
                `specification.${this.facet}(): server command exited before it was ready.\nCommand: ${this.options.command}\nOutput:\n${this.output}`,
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
                            `specification.${this.facet}(): the ready pattern ${String(banner)} matched but its capture group is not a port ("${found[1]}").\nCommand: ${this.options.command}\nOutput:\n${this.output}`,
                        );
                    }
                    this.port = captured;
                    return `http://127.0.0.1:${captured}`;
                }
                if (exited) {
                    died();
                }
                if (Date.now() >= deadline) {
                    await this.stop();
                    throw new Error(
                        `specification.${this.facet}(): server did not print ${String(banner)} within ${timeout}ms.\nCommand: ${this.options.command}\nOutput:\n${this.output}`,
                    );
                }
                await delay(READY_POLL_INTERVAL_MS);
            }
        }

        const baseUrl = `http://127.0.0.1:${port}`;
        const readyUrl = `${baseUrl}${this.options.ready ?? '/'}`;
        for (;;) {
            if (exited) {
                died();
            }
            try {
                await fetch(readyUrl, { redirect: 'manual' });
                this.port = port;
                return baseUrl;
            } catch {
                if (Date.now() >= deadline) {
                    await this.stop();
                    throw new Error(
                        `specification.${this.facet}(): server did not answer on ${readyUrl} within ${timeout}ms.\nCommand: ${this.options.command}\nOutput:\n${this.output}`,
                    );
                }
                await delay(READY_POLL_INTERVAL_MS);
            }
        }
    }

    /** Where the child runs: the stated `cwd` under the root, or the root. */
    private workingDirectory(): string {
        return this.options.cwd === undefined
            ? this.root
            : resolvePath(this.root, this.options.cwd);
    }

    /**
     * The one-shot command, run before the process is spawned. It must exit 0:
     * a build that failed is not a spec that failed later on a missing file,
     * and the difference is what this reports.
     */
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
                `specification.${this.facet}(): \`before\` exited ${outcome.status ?? 'without a status'}.\n` +
                    `Command: ${before}\nOutput:\n${(outcome.stdout ?? '') + (outcome.stderr ?? '')}`,
            );
        }
    }

    /** Terminate the server process group (idempotent). */
    async stop(): Promise<void> {
        const { child } = this;
        if (!child) {
            return;
        }
        this.child = null;

        await new Promise<void>((resolve) => {
            let exited = false;
            child.on('exit', () => {
                exited = true;
                resolve();
            });
            if (child.exitCode !== null || child.signalCode !== null) {
                resolve();
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

    /** Group-aware kill: signal the process group, fall back to the child. */
    private kill(child: ChildProcess, signal: NodeJS.Signals): void {
        if (child.pid !== undefined && process.platform !== 'win32') {
            try {
                process.kill(-child.pid, signal);
                return;
            } catch {
                // Group already reaped (ESRCH) — fall through to direct kill.
            }
        }
        child.kill(signal);
    }
}
