import { type ChildProcess, spawn } from 'node:child_process';
import { createServer } from 'node:net';

/** Grace period between SIGTERM and the SIGKILL escalation. */
const KILL_GRACE_MS = 2000;
const DEFAULT_READY_TIMEOUT = 30_000;
const READY_POLL_INTERVAL_MS = 250;

/** Options for the local server started by `specification.website()`. */
export interface ServeOptions {
    /** Shell command that starts the site. Receives the chosen port as `PORT`. */
    command: string;
    /** Fixed port. Default: an OS-assigned free port, injected as `PORT`. */
    port?: number;
    /** Path polled until it answers with any HTTP status. Default `/`. */
    ready?: string;
    /** Readiness budget in milliseconds. Default 30 000. */
    timeout?: number;
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Ask the OS for a free TCP port. */
function findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.listen(0, () => {
            const address = server.address();
            if (address === null || typeof address === 'string') {
                server.close();
                reject(new Error('could not determine a free port'));
                return;
            }
            const { port } = address;
            server.close(() => resolve(port));
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
    private child: ChildProcess | null = null;
    private readonly options: ServeOptions;
    private output = '';
    private readonly root: string;

    constructor(options: ServeOptions, root: string) {
        this.options = options;
        this.root = root;
    }

    /** Start the server and resolve with its base URL once it answers HTTP. */
    async start(): Promise<string> {
        const port = this.options.port ?? (await findFreePort());
        const baseUrl = `http://127.0.0.1:${port}`;
        const readyUrl = `${baseUrl}${this.options.ready ?? '/'}`;
        const timeout = this.options.timeout ?? DEFAULT_READY_TIMEOUT;

        this.child = spawn(this.options.command, [], {
            cwd: this.root,
            detached: process.platform !== 'win32',
            env: { ...process.env, PORT: String(port) },
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
        for (;;) {
            if (exited) {
                throw new Error(
                    `specification.website(): server command exited before answering HTTP.\nCommand: ${this.options.command}\nOutput:\n${this.output}`,
                );
            }
            try {
                await fetch(readyUrl, { redirect: 'manual' });
                return baseUrl;
            } catch {
                if (Date.now() >= deadline) {
                    await this.stop();
                    throw new Error(
                        `specification.website(): server did not answer on ${readyUrl} within ${timeout}ms.\nCommand: ${this.options.command}\nOutput:\n${this.output}`,
                    );
                }
                await delay(READY_POLL_INTERVAL_MS);
            }
        }
    }

    /** Terminate the server process group (idempotent). */
    async stop(): Promise<void> {
        const child = this.child;
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
