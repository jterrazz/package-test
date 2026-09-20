/* oxlint-disable eslint/class-methods-use-this -- a `ServiceHandle` is an interface of eleven members and a process answers "nothing to do" to most of them: no image to pull, no database adapter, no per-worker namespace. Each stub states that answer where the contract asks for it. */
import type { DatabasePort } from '../../ports/database.port.js';
import type { IsolationStrategy } from '../../ports/isolation.port.js';
import type { ServiceHandle } from '../../ports/service.port.js';
import { ServeAdapter } from '../website/serve.adapter.js';
import type { ProcessOptions } from '../website/serve.adapter.js';

/**
 * An external process, declared like any other service.
 *
 * One shape for every one of them: a site's dev server, an API behind the
 * site, the bundler a simulator loads from. Without it each is declared
 * somewhere else — a facet option, a document's `serve:` entry, a `beforeAll`
 * spawning a child and an `afterAll` that sometimes forgets to kill it — and
 * the lifetime belongs to whoever remembered. Here it is the framework's.
 *
 * It sits in a `services` record beside `postgres()`, `redis()` and
 * `sqlite()`, so it starts after them and can be handed their connection
 * strings through `env`, and it is stopped with the specification.
 */
export class ProcessHandle implements ServiceHandle {
    /** Embedded: nothing to pull, nothing to run in a container. */
    readonly defaultImage = '';
    readonly defaultPort = 0;
    readonly environment: Record<string, string> = {};
    readonly type = 'process';

    serviceName: null | string = null;
    connectionString = '';
    started = false;

    private adapter: null | ServeAdapter = null;
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
        // Readiness IS the healthcheck here: `start()` does not resolve until
        // The process answers on `ready`, so there is nothing left to probe.
        await Promise.resolve();
    }

    /**
     * A process is not a container, so the orchestrator never starts it: the
     * facet does, once its siblings are up and their connection strings are
     * readable ({@link startProcessServices}).
     */
    async initialize(): Promise<void> {
        await Promise.resolve();
    }

    /**
     * Isolation is the RUN's, not the worker's — and a run here is one
     * EVALUATION of the specification module. Under vitest's default
     * isolation that is once per test file, so two files that import the same
     * specification get a child each, with the id the facet minted for it.
     * Nothing is acquired or reset between tests: the id is what tells two
     * runs apart, never a label a spec samples.
     */
    isolation(): IsolationStrategy {
        return {
            acquire: async () => {
                await Promise.resolve();
            },
            release: async () => {
                await Promise.resolve();
            },
            reset: async () => {
                await Promise.resolve();
            },
        };
    }

    async reset(): Promise<void> {
        // A process keeps its own state: resetting it between chains would
        // Mean restarting it, which is a different spec, not a cleaner one.
        await Promise.resolve();
    }

    /**
     * Spawn it and wait until it answers. `services` is every handle declared
     * beside this one, already started — what an `env` function reads.
     *
     * @internal
     */
    async spawnWith(
        root: string,
        services: Record<string, { connectionString: string }>,
        runId: string,
    ): Promise<void> {
        const stated =
            typeof this.options.env === 'function' ? this.options.env(services) : this.options.env;
        this.adapter = new ServeAdapter(this.options, root, 'process', {
            ...stated,
            // Every process of one run carries the same id, minted by the
            // Facet: a spec that needs a unique label reads it instead of
            // Sampling `Date.now()` into an oracle (CONVENTIONS D16).
            TEST_RUN_ID: runId,
        });
        this.connectionString = await this.adapter.start();
        this.started = true;
    }

    /** Terminate the process group. Idempotent. */
    async shutdown(): Promise<void> {
        await this.adapter?.stop();
        this.adapter = null;
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
                'process(): the URL is known once the process is ready — read it from the ' +
                    'started services record, never at declaration time.',
            );
        }
        return this.connectionString;
    }
}

/**
 * Declare an external process the framework owns for the life of the
 * specification.
 *
 * @example
 *   const { website, cleanup } = await specification.website({
 *       services: { api: process({ command: 'bin/server web', ready: '/health' }) },
 *       server: ({ api }) => process({
 *           command: 'next dev',
 *           env: { NEXT_PUBLIC_API_URL: api.connectionString },
 *       }),
 *   });
 */
export function processService(options: ProcessOptions): ProcessHandle {
    return new ProcessHandle(options);
}
