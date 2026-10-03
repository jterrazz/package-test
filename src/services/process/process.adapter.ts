import { refusal } from '../../chain/refusals/refusal.js';
import type { DatabasePort } from '../database.port.js';
import type { IsolationStrategy } from '../isolation.port.js';
import type { ServiceHandle } from '../service.port.js';
import { ServedProcess } from './serve.js';

/** The one shape an external process takes: `website({ server })`, `services: { api: process(…) }`, `serve:`. */
export type ProcessOptions = {
    /** A one-shot command run once per specification before the spawn, which must exit 0. */
    before?: string;
    /** Shell command that starts the process. Receives the chosen port as `PORT`. */
    command: string;
    /** Working directory, relative to the project root. Default: the root itself. */
    cwd?: string;
    /** Environment on top of the runner's; a function receives the services already started. */
    env?:
        | ((services: Record<string, { connectionString: string }>) => Record<string, string>)
        | Record<string, string>;
    /** Fixed port. Default: an OS-assigned free port, injected as `PORT`. */
    port?: number;
    /** Readiness: a path polled until any HTTP status answers (`PORT` injected), or a regex over the output whose one group captures the port. */
    ready?: RegExp | string;
    /** Readiness budget in milliseconds. Default 30 000. */
    timeout?: number;
};

/** An external process declared as a service: started after its siblings, stopped with the specification. */
async function nothingToIsolate(): Promise<void> {
    // invariant: the minted id already tells this run's child apart, so no isolation step acts.
}

export class ProcessHandle implements ServiceHandle {
    /** Embedded: nothing to pull, nothing to run in a container. */
    readonly defaultImage = '';
    readonly defaultPort = 0;
    readonly environment: Record<string, string> = {};
    readonly type = 'process';

    serviceName: null | string = null;
    connectionString = '';
    started = false;

    private served: null | ServedProcess = null;
    private readonly options: ProcessOptions;

    constructor(options: ProcessOptions) {
        this.options = options;
    }

    buildConnectionString(host: string, port: number): string {
        return `http://${host}:${port}`;
    }

    createDatabaseAdapter(): DatabasePort | null {
        return null;
    }

    async healthcheck(): Promise<void> {
        // invariant: readiness IS the healthcheck here: `start()` does not resolve until
        // the process answers on `ready`, so there is nothing left to probe.
    }

    async initialize(): Promise<void> {
        // invariant: never started by the orchestrator: the facet starts it once its siblings' connection strings are readable.
    }

    /** Isolation is the run's: one child per evaluation of the specification module, told apart by the minted id. */
    isolation(): IsolationStrategy {
        return { acquire: nothingToIsolate, release: nothingToIsolate, reset: nothingToIsolate };
    }

    async reset(): Promise<void> {
        // invariant: resetting a process between chains would mean restarting it.
    }

    /** Spawn it and wait until it answers; `services` is every sibling, already started. */
    async spawnWith(
        root: string,
        services: Record<string, { connectionString: string }>,
        runId: string,
    ): Promise<void> {
        const stated =
            typeof this.options.env === 'function' ? this.options.env(services) : this.options.env;
        this.served = new ServedProcess(this.options, root, 'process', {
            ...stated,
            // invariant: one id per run, minted by the facet: a spec reads it instead of sampling `Date.now()` (`no-sampled-value-in-expectation`).
            TEST_RUN_ID: runId,
        });
        this.connectionString = await this.served.start();
        this.started = true;
    }

    /** Terminate the process group. Idempotent. */
    async shutdown(): Promise<void> {
        await this.served?.stop();
        this.served = null;
        this.started = false;
    }

    /** What it was declared as — what a facet reads to start it in a slot of its own. */
    get spec(): ProcessOptions {
        return this.options;
    }

    /** The base URL it came up on — known only once it is started. */
    get url(): string {
        if (!this.started) {
            throw new Error(
                refusal({
                    fix: 'read it from the started services record — `env: (services) => …` or `server: (services) => …` — never at declaration time',
                    found: 'process().url read before the process was ready',
                    read: 'docs/18-services.md#process--the-one-shape-an-external-process-takes',
                    why: 'A process’s URL is known once it is ready.',
                }),
            );
        }
        return this.connectionString;
    }
}

/** Declare an external process the framework owns for the life of the specification. */
export function processService(options: ProcessOptions): ProcessHandle {
    return new ProcessHandle(options);
}
