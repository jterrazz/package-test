import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

// Type-only import — erased at runtime; the msw integration stays lazy (I1).
import type { InterceptRegistration } from '../../../integrations/msw/intercept.js';
import type { InterceptContract } from '../../contracts/contract.js';
import type {
    InterceptEntry,
    InterceptResponder,
    InterceptResponse,
    InterceptTrigger,
} from '../../contracts/types.js';
import { parseRequestFile } from '../../http-files/http-file.js';
import type { BrowserPort, VisitScenario } from '../../ports/browser.port.js';
import type { CliEnv, CliOutput, CliPort, ExecOptions } from '../../ports/cli.port.js';
import type { DatabasePort } from '../../ports/database.port.js';
import type { ServerPort } from '../../ports/server.port.js';
import type { ServiceHandle } from '../../ports/service.port.js';
import { HttpResult } from '../api/result.js';
import { CliResult } from '../cli/result.js';
import { FetchResult, PageResult } from '../website/result.js';
import { toConstantCase } from './binding.js';
import { getCallerDir } from './caller.js';
import { copyPlan } from './fixtures.js';
import { BaseResult, validateDatabaseOption } from './result/result.js';

// ── Types ──

/** A named job that can be triggered via jobs.trigger(). */
export interface JobHandle {
    name: string;
    execute: () => Promise<void>;
}

/**
 * Configuration for the docker-aware cli mode. When set on
 * {@link SpecificationConfig}, the cli runner generates a test-run id, injects
 * it into the child env under `envVar`, then queries Docker for every
 * container carrying `testRunLabel=<id>` after the command exits.
 */
export interface DockerSpecConfig {
    envVar: string;
    nameLabel: string;
    testRunLabel: string;
}

/** Adapter configuration passed to the specification facets at setup time. */
export interface SpecificationConfig {
    /** Base URL of the website under test (website facet only). */
    baseUrl?: string;
    /**
     * Lazy browser accessor (website facet only). The first `.visit()`
     * launches the shared browser instance; `.fetch()`-only spec files never
     * pay the browser cost.
     */
    browser?: () => Promise<BrowserPort>;
    /**
     * Cross-origin request policy for visits (website facet only): `'block'`
     * aborts requests leaving the site under test — the browser-side analog
     * of strict intercepts.
     */
    external?: 'allow' | 'block';
    command?: CliPort;
    database?: DatabasePort;
    /**
     * Keys of the declared services record that are databases. Drives the
     * CONVENTIONS A7 rule: with 2+ databases the `database` option is
     * mandatory on `.seed()` / `.table()`; with exactly one it is forbidden.
     */
    databaseKeys?: string[];
    databases?: Map<string, DatabasePort>;
    dockerConfig?: DockerSpecConfig;
    /**
     * Unique id shared by every spec from this runner instance.
     * Stable for the runner's lifetime so multi-step tests (spawn in
     * one run, inspect in another) see the same container scope. The
     * facet factories auto-populate this when `dockerConfig` is present.
     */
    dockerTestRunId?: string;
    /**
     * When set, `.intercept()` is unavailable on this runner and throws this
     * reason immediately (compose mode — MSW is in-process, CONVENTIONS I3).
     */
    interceptDisabledReason?: string;
    jobs?: JobHandle[];
    server?: ServerPort;
    /**
     * The declared services record. In cli mode, drives the automatic
     * connection-URL injection into the child env (CONVENTIONS B6):
     * `<KEY>_URL` per service, plus `DATABASE_URL` / `REDIS_URL` when
     * unambiguous.
     */
    services?: Record<string, ServiceHandle>;
    /**
     * Optional normaliser applied to command stdout/stderr before every
     * comparison. Does not mutate the raw `.text` accessor.
     */
    transform?: (text: string) => string;
}

/** A SQL seed file to execute before the action, optionally targeting a named database. */
export interface SeedEntry {
    database?: string;
    file: string;
}

/** A fixture file or directory to copy into the working directory before execution. */
export interface FixtureEntry {
    file: string;
}

/** An HTTP request to perform against the server adapter. */
export interface RequestEntry {
    /** Inline body value — objects are JSON-serialized, strings sent raw. */
    body?: unknown;
    /** Headers parsed from a `requests/*.http` file (chain headers win). */
    fileHeaders?: Record<string, string>;
    method: string;
    path: string;
    /** A `requests/*.http` file to load method/path/headers/body from. */
    requestFile?: string;
}

// ── Facet views ──

/**
 * The `api` facet — HTTP chain entry handed out by `specification.api()`.
 * Setup methods chain; action methods are terminal: they execute the spec
 * and resolve to the result.
 *
 * The `DatabaseKey` parameter is the typed vocabulary of `.seed()`: the keys
 * of the declared services record that are databases.
 */
export interface ApiSpecification<DatabaseKey extends string = string> {
    /** Set HTTP headers for the request. Multiple calls merge. */
    headers: (headers: Record<string, string>) => ApiSpecification<DatabaseKey>;
    /** Intercept an outgoing HTTP call — a contract, an array of contracts, or a trigger + response pair. */
    intercept: ((
        contractOrContracts: InterceptContract | InterceptContract[],
    ) => ApiSpecification<DatabaseKey>) &
        ((
            trigger: InterceptTrigger,
            response: InterceptResponder | InterceptResponse | string,
        ) => ApiSpecification<DatabaseKey>);
    /** Queue a SQL seed file from `seeds/` to run before the action. */
    seed: (file: string, options?: { database?: DatabaseKey }) => ApiSpecification<DatabaseKey>;

    /** Send a DELETE request and resolve with the result. */
    delete: (path: string) => Promise<HttpResult>;
    /** Send a GET request and resolve with the result. */
    get: (path: string) => Promise<HttpResult>;
    /** Send a POST request (optional inline JSON body) and resolve with the result. */
    post: (path: string, body?: unknown) => Promise<HttpResult>;
    /** Send a PUT request (optional inline JSON body) and resolve with the result. */
    put: (path: string, body?: unknown) => Promise<HttpResult>;
    /** Send the complete request described by `requests/<file>` (.http format). */
    request: (file: string) => Promise<HttpResult>;
}

/**
 * The `jobs` facet — job chain entry handed out by `specification.jobs()`.
 * Jobs run in-process by definition (CONVENTIONS A5/A8).
 */
export interface JobsSpecification<DatabaseKey extends string = string> {
    /** Intercept an outgoing HTTP call — a contract, an array of contracts, or a trigger + response pair. */
    intercept: ((
        contractOrContracts: InterceptContract | InterceptContract[],
    ) => JobsSpecification<DatabaseKey>) &
        ((
            trigger: InterceptTrigger,
            response: InterceptResponder | InterceptResponse | string,
        ) => JobsSpecification<DatabaseKey>);
    /** Queue a SQL seed file from `seeds/` to run before the action. */
    seed: (file: string, options?: { database?: DatabaseKey }) => JobsSpecification<DatabaseKey>;

    /** Execute the named job registered via the `jobs` option and resolve with the result. */
    trigger: (name: string) => Promise<BaseResult>;
}

/**
 * The `cli` facet — command chain entry handed out by `specification.cli()`.
 * Setup methods chain; `.exec()` is the single terminal action (CONVENTIONS
 * B2) — `{ waitFor?, timeout? }` covers long-running processes.
 */
export interface CliSpecification<DatabaseKey extends string = string> {
    /** Set environment variables on the child process. `$WORKDIR` expands; `null` unsets. */
    env: (env: CliEnv) => CliSpecification<DatabaseKey>;
    /**
     * Copy a fixture into the working directory before execution. The path is
     * feature-local (`<test-dir>/fixtures/<path>`) or, with a `$FIXTURES/`
     * prefix, from the shared pool at `<specs-root>/fixtures/`. A trailing
     * slash spreads a directory's contents into the cwd; without one a
     * directory (or file) is copied under its own name. Chained calls layer.
     */
    fixture: (path: string) => CliSpecification<DatabaseKey>;
    /** Queue a SQL seed file from `seeds/` to run against a database before the action. */
    seed: (file: string, options?: { database?: DatabaseKey }) => CliSpecification<DatabaseKey>;

    /**
     * Execute the command (or sequence of commands) and resolve with the
     * result. Called with no arguments (`cli.exec()`), the binary runs bare —
     * no CLI arguments. With `{ waitFor, timeout }`, the process is
     * long-running: it resolves when the pattern appears and is killed at the
     * timeout.
     */
    exec: (args?: string | string[], options?: ExecOptions) => Promise<CliResult>;
}

/**
 * The `website` facet — page chain entry handed out by
 * `specification.website()`. Setup methods chain; action methods are
 * terminal. `.visit()` renders the page in the shared browser; `.fetch()`
 * performs one raw HTTP exchange and never follows redirects.
 */
export interface WebsiteSpecification {
    /** Set HTTP headers for the exchange (incl. User-Agent overrides). Multiple calls merge. */
    headers: (headers: Record<string, string>) => WebsiteSpecification;

    /** Perform one raw HTTP GET — redirects surface as 3xx results, never followed. */
    fetch: (path: string) => Promise<FetchResult>;
    /**
     * Render the page in the shared browser and resolve with the captured
     * document. With a scenario, the visitor interacts first (the When) and
     * the capture reflects the FINAL page state.
     */
    visit: (path: string, scenario?: VisitScenario) => Promise<PageResult>;
}

/**
 * Fluent builder for declaring a single test specification.
 *
 * Chain setup methods ({@link seed}, {@link fixture}, {@link env}), then call
 * an action ({@link get}, {@link post}, {@link exec}, {@link trigger}) —
 * actions are terminal: they execute the specification and resolve to a
 * typed result.
 *
 * Facets expose this class through the narrower {@link ApiSpecification} /
 * {@link JobsSpecification} / {@link CliSpecification} views so each facet
 * only surfaces the methods that make sense for it.
 */
export class SpecificationBuilder
    implements
        ApiSpecification<string>,
        CliSpecification<string>,
        JobsSpecification<string>,
        WebsiteSpecification
{
    private commandEnv: CliEnv = {};
    private config: SpecificationConfig;
    private fixtures: FixtureEntry[] = [];
    private intercepts: InterceptEntry[] = [];
    private requestHeaders: Record<string, string> = {};
    private seeds: SeedEntry[] = [];
    private testDir: string;

    constructor(config: SpecificationConfig, testDir: string) {
        this.config = config;
        this.testDir = testDir;
    }

    // ── Setup ──

    /**
     * Queue a SQL seed file to run before the action.
     *
     * With two or more declared databases the `database` option is mandatory;
     * with exactly one it is forbidden (CONVENTIONS A7).
     *
     * @example
     *   api.seed("users.sql", { database: "db" }).get("/users");
     */
    seed(file: string, options?: { database?: string }): this {
        validateDatabaseOption('seed', this.config, options?.database);
        this.seeds.push({ database: options?.database, file });
        return this;
    }

    /**
     * Copy a fixture into the working directory before execution.
     *
     * The path is feature-local (resolved under `<test-dir>/fixtures/`) or, with
     * a `$FIXTURES/` prefix, from the shared pool at `<specs-root>/fixtures/`.
     * Copy semantics follow rsync's trailing-slash rule: `dir/` spreads the
     * directory's contents into the cwd, while `dir` (or a plain file) is copied
     * under its own basename. Chained calls layer in order — a later fixture
     * overwrites files written by an earlier one.
     *
     * @example
     *   cli.fixture('$FIXTURES/cli-app/').exec('build');   // shared project, spread
     *   cli.fixture('config.toml').exec('migrate');        // feature-local file
     */
    fixture(path: string): this {
        this.fixtures.push({ file: path });
        return this;
    }

    /**
     * Set environment variables for the command process. Merged on top of process.env.
     * Use `null` to unset a variable. Multiple calls merge.
     *
     * The token `$WORKDIR` (in any value) is replaced with the actual working
     * directory at run-time — useful for tests that need a fully isolated `HOME`.
     *
     * @example
     *   cli.env({ HOME: "$WORKDIR", TZ: "UTC" }).exec("status");
     */
    env(env: CliEnv): this {
        this.commandEnv = { ...this.commandEnv, ...env };
        return this;
    }

    /**
     * Set HTTP headers for the request. Multiple calls merge; chain headers
     * win over headers from a `requests/*.http` file.
     *
     * @example
     *   api.headers({ 'Accept-Language': 'fr' }).get("/articles");
     */
    headers(headers: Record<string, string>): this {
        this.requestHeaders = { ...this.requestHeaders, ...headers };
        return this;
    }

    /**
     * Intercept an outgoing HTTP request and return a controlled response.
     * Uses MSW under the hood. Intercepts are queued — multiple calls with the
     * same trigger fire sequentially (first match consumed first).
     *
     * Prefer contracts for anything business-meaningful: declare the
     * interaction once with {@link defineContract} under `contracts/` and pass
     * the imported contract here. Inline trigger + response stays available
     * for one-off technical cases.
     *
     * An array of contracts registers them in order — identical to calling
     * `.intercept()` once per contract, so same-trigger entries queue FIFO in
     * array order. There is no variadic form (it would collide with the
     * trigger + response pair).
     *
     * @example
     *   // Contract (recommended) — request + response in one named artifact
     *   import classifyArticle from '../../../spec/contracts/classify-article.openai.js';
     *   .intercept(classifyArticle)
     *
     *   // Array of contracts — registered in order (FIFO per trigger)
     *   .intercept([classifyArticle, draftReply])
     *
     *   // Inline trigger + response
     *   .intercept(openai.responses({...}), openai.reply({ categories: ['TECH'] }))
     *
     *   // Dynamic response — computed from the observed request per consumption
     *   .intercept(http.post(url), (request) => http.json({ echoed: request.body }))
     *
     *   // JSON fixture file (loaded from intercepts/ directory)
     *   .intercept(http.get(url), 'http/world-news-tech.json')
     */
    intercept(contractOrContracts: InterceptContract | InterceptContract[]): this;
    intercept(
        trigger: InterceptTrigger,
        response: InterceptResponder | InterceptResponse | string,
    ): this;
    intercept(
        triggerOrContracts: InterceptContract | InterceptContract[] | InterceptTrigger,
        maybeResponse?: InterceptResponder | InterceptResponse | string,
    ): this {
        if (this.config.interceptDisabledReason) {
            throw new Error(`.intercept(): ${this.config.interceptDisabledReason}`);
        }

        if (Array.isArray(triggerOrContracts)) {
            for (const contract of triggerOrContracts) {
                this.registerIntercept(contract);
            }
            return this;
        }

        this.registerIntercept(triggerOrContracts, maybeResponse);
        return this;
    }

    /** Register a single intercept — a contract, or a trigger + response pair. */
    private registerIntercept(
        triggerOrContract: InterceptContract | InterceptTrigger,
        maybeResponse?: InterceptResponder | InterceptResponse | string,
    ): void {
        const isContract = 'trigger' in triggerOrContract && 'response' in triggerOrContract;
        const trigger = isContract
            ? (triggerOrContract as InterceptContract).trigger
            : (triggerOrContract as InterceptTrigger);
        const response = isContract
            ? (triggerOrContract as InterceptContract).response
            : maybeResponse!;

        if (typeof response === 'string') {
            // File path format: 'adapter/filename.json'
            const slashIndex = response.indexOf('/');
            if (slashIndex === -1) {
                throw new Error(
                    `.intercept(): file path must be 'adapter/filename.json' (e.g. 'openai/ingest-tech.json'), got '${response}'`,
                );
            }

            const adapterName = response.slice(0, slashIndex);
            if (adapterName !== trigger.adapter) {
                throw new Error(
                    `.intercept(): adapter mismatch - trigger uses '${trigger.adapter}' but file path starts with '${adapterName}/'`,
                );
            }

            const filePath = resolve(this.testDir, 'intercepts', response);
            const data = JSON.parse(readFileSync(filePath, 'utf8'));
            const resolved = trigger.wrap(data);
            this.intercepts.push({ trigger, response: resolved });
        } else {
            this.intercepts.push({ trigger, response });
        }
    }

    // ── HTTP actions (terminal) ──

    /**
     * Send the complete request described by `requests/<file>` — first line
     * `METHOD /path`, then headers until a blank line, then the body.
     * Headers set via `.headers()` merge on top of the file's headers.
     *
     * @example
     *   const result = await api.request("create-user.http");
     */
    request(file: string): Promise<HttpResult> {
        return this.executeHttp({ method: '', path: '', requestFile: file });
    }

    /**
     * Send a GET request to the server adapter and resolve with the result.
     *
     * @example
     *   const result = await api.get("/api/items");
     */
    get(path: string): Promise<HttpResult> {
        return this.executeHttp({ method: 'GET', path });
    }

    /**
     * Send a POST request to the server adapter and resolve with the result.
     *
     * @param body - Optional inline JSON body. Prefer `.request('name.http')`
     *   for file-based request bodies.
     * @example
     *   const result = await api.post("/api/items", { name: "Widget" });
     */
    post(path: string, body?: unknown): Promise<HttpResult> {
        return this.executeHttp({ body, method: 'POST', path });
    }

    /** Send a PUT request to the server adapter and resolve with the result. */
    put(path: string, body?: unknown): Promise<HttpResult> {
        return this.executeHttp({ body, method: 'PUT', path });
    }

    /** Send a DELETE request to the server adapter and resolve with the result. */
    delete(path: string): Promise<HttpResult> {
        return this.executeHttp({ method: 'DELETE', path });
    }

    // ── Command actions (terminal) ──

    /**
     * Execute a command (or a sequence of commands) in an isolated working
     * directory and resolve with the result. When an array is passed, commands
     * run sequentially and stop on the first non-zero exit code.
     *
     * With `{ waitFor, timeout }` the process is treated as long-running: it
     * resolves (exit code 0) as soon as `waitFor` appears in stdout/stderr,
     * and is killed at `timeout` (exit code 124). This is the single
     * execution method — there is no `.spawn()` (CONVENTIONS B2).
     *
     * Invoked with no arguments, the binary runs bare (no CLI args) — clearer
     * than the `.exec('')` idiom. An empty ARRAY stays an error: a command
     * sequence must name at least one command.
     *
     * @example
     *   const result = await cli.exec();                    // run the binary bare
     *   const result = await cli.exec("init --name demo");
     *   const result = await cli.exec(["init", "build"]);
     *   const result = await cli.exec("dev --port 0", { waitFor: "Listening on", timeout: 10_000 });
     */
    exec(args: string | string[] = '', options?: ExecOptions): Promise<CliResult> {
        if (Array.isArray(args) && args.length === 0) {
            throw new Error('exec([]) requires at least one command');
        }
        if (options && Array.isArray(args)) {
            throw new Error(
                '.exec(): waitFor/timeout options are not supported with a command sequence',
            );
        }
        return this.executeCommand({ args, options });
    }

    // ── Website actions (terminal) ──

    /**
     * Perform one raw HTTP GET against the website under test and resolve
     * with the exchange. Redirects are never followed — a 308 IS the result,
     * with its `location` readable on the result. The scalpel for wire-level
     * surfaces: robots.txt, sitemaps, llms.txt, redirect policies.
     *
     * @example
     *   const result = await website.fetch('/robots.txt');
     *   expect(result.status).toBe(200);
     *   expect(result.body).toMatch('robots.txt');
     */
    fetch(path: string): Promise<FetchResult> {
        return this.executeSetup(null, () => this.runFetchAction(path));
    }

    /**
     * Render the page in the shared browser instance and resolve with the
     * captured document — rendered title, head elements, JSON-LD blocks,
     * body text, console errors. One browser per runner; each visit gets a
     * fresh, isolated context.
     *
     * @example
     *   const result = await website.visit('/articles');
     *   expect(result.head).toMatch('articles.head.json');
     *
     *   const result = await website.visit('/', async (visitor) => {
     *       await visitor.click(link('Articles'));
     *   });
     *   expect(result.url).toContain('/articles');
     */
    visit(path: string, scenario?: VisitScenario): Promise<PageResult> {
        return this.executeSetup(null, () => this.runVisitAction(path, scenario));
    }

    // ── Job actions (terminal) ──

    /**
     * Execute the named job registered via the `jobs` option of
     * `specification.jobs()` and resolve with the result.
     *
     * @example
     *   const result = await jobs.intercept(classifyArticle).trigger('report-refresh');
     */
    async trigger(name: string): Promise<BaseResult> {
        return this.executeSetup(null, () => this.runJobAction(name));
    }

    // ── Private execution pipeline ──

    private async executeHttp(request: RequestEntry): Promise<HttpResult> {
        return this.executeSetup(null, () => this.runHttpAction(request));
    }

    private async executeCommand(action: {
        args: string | string[];
        options?: ExecOptions;
    }): Promise<CliResult> {
        const workDir = this.prepareWorkDir();
        return this.executeSetup(workDir, () => this.runCommandAction(workDir, action));
    }

    /**
     * Shared setup pipeline: reset databases, run seeds, copy fixtures,
     * register intercepts — then run the action and clean up intercepts.
     */
    private async executeSetup<T>(workDir: null | string, action: () => Promise<T>): Promise<T> {
        // Reset all databases
        if (this.config.databases) {
            for (const db of this.config.databases.values()) {
                await db.reset();
            }
        } else if (this.config.database) {
            await this.config.database.reset();
        }

        // Execute seeds — SQL fragments applied to a database adapter.
        for (const entry of this.seeds) {
            let db: DatabasePort | undefined;
            if (entry.database && this.config.databases) {
                db = this.config.databases.get(entry.database);
                if (!db) {
                    throw new Error(
                        `seed() targets database "${entry.database}" but it was not found. Available: ${[...this.config.databases.keys()].join(', ')}`,
                    );
                }
            } else {
                db = this.config.database;
            }

            if (!db) {
                throw new Error('seed() requires a database adapter');
            }

            const sql = readFileSync(resolve(this.testDir, 'seeds', entry.file), 'utf8');
            await db.seed(sql);
        }

        // Copy fixtures into the working directory. Feature-local or shared
        // ($FIXTURES) source, rsync trailing-slash copy semantics, layered in
        // Chain order — a later fixture overwrites an earlier file.
        if (this.fixtures.length > 0 && workDir) {
            for (const entry of this.fixtures) {
                const { dest, src } = copyPlan(entry.file, this.testDir, workDir);
                cpSync(src, dest, { recursive: true });
            }
        }

        // Register HTTP intercepts via MSW. Strict (CONVENTIONS D7): once a
        // Chain declares at least one intercept, every outgoing HTTP request
        // Must match a registered, unconsumed intercept — an unmatched
        // Request rejects the action promise with an explicit error. Chains
        // With zero intercepts keep MSW off entirely (network not guarded).
        let registration: InterceptRegistration | null = null;
        if (this.intercepts.length > 0) {
            const { registerIntercepts } = await import('../../../integrations/msw/intercept.js');
            registration = await registerIntercepts(this.intercepts);
        }

        // Execute action
        try {
            const value = await action();
            const violation = registration?.violation();
            if (violation) {
                throw violation;
            }
            return value;
        } catch (error) {
            // The strict-intercept error is the actionable failure — prefer
            // It over the app-level fallout of the 501 the request received.
            throw registration?.violation() ?? error;
        } finally {
            registration?.cleanup();
        }
    }

    // ── Private ──

    private resolveEnv(workDir: string): CliEnv | undefined {
        const keys = Object.keys(this.commandEnv);
        if (keys.length === 0) {
            return undefined;
        }

        const resolved: CliEnv = {};
        for (const key of keys) {
            const value = this.commandEnv[key];
            resolved[key] =
                typeof value === 'string' ? value.replace(/\$WORKDIR/g, workDir) : value;
        }
        return resolved;
    }

    private prepareWorkDir(): string {
        // Every command spec runs in a fresh, empty temp directory. Fixtures
        // Are layered in afterwards via .fixture() (see executeSetup) — the
        // Runner never writes into the source tree.
        return mkdtempSync(resolve(tmpdir(), 'spec-command-'));
    }

    private async runHttpAction(request: RequestEntry): Promise<HttpResult> {
        if (!this.config.server) {
            throw new Error('HTTP actions require a server adapter (use specification.api())');
        }

        let { body, method, path } = request;
        let fileHeaders: Record<string, string> | undefined;

        if (request.requestFile) {
            const raw = readFileSync(
                resolve(this.testDir, 'requests', request.requestFile),
                'utf8',
            );
            const parsed = parseRequestFile(raw, `requests/${request.requestFile}`);
            body = parsed.body;
            fileHeaders = parsed.headers;
            method = parsed.method;
            path = parsed.path;
        }

        const headers = { ...fileHeaders, ...this.requestHeaders };
        const response = await this.config.server.request(
            method,
            path,
            body,
            Object.keys(headers).length > 0 ? headers : undefined,
        );

        return new HttpResult({
            config: this.config,
            response,
            testDir: this.testDir,
        });
    }

    private async runFetchAction(path: string): Promise<FetchResult> {
        const baseUrl = this.requireBaseUrl('fetch');

        const headers =
            Object.keys(this.requestHeaders).length > 0 ? this.requestHeaders : undefined;
        const response = await fetch(`${baseUrl}${path}`, { headers, redirect: 'manual' });
        const body = await response.text();
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });

        return new FetchResult({
            config: this.config,
            exchange: { body, headers: responseHeaders, status: response.status },
            testDir: this.testDir,
        });
    }

    private async runVisitAction(path: string, scenario?: VisitScenario): Promise<PageResult> {
        const baseUrl = this.requireBaseUrl('visit');
        if (!this.config.browser) {
            throw new Error('.visit() requires a browser adapter (use specification.website())');
        }

        const browser = await this.config.browser();
        const headers =
            Object.keys(this.requestHeaders).length > 0 ? this.requestHeaders : undefined;
        const page = await browser.open(`${baseUrl}${path}`, {
            baseUrl,
            external: this.config.external ?? 'allow',
            headers,
            scenario,
        });

        return new PageResult({
            config: this.config,
            page,
            testDir: this.testDir,
        });
    }

    private requireBaseUrl(method: string): string {
        if (!this.config.baseUrl) {
            throw new Error(
                `.${method}() requires a website under test (use specification.website())`,
            );
        }
        return this.config.baseUrl;
    }

    private async runJobAction(name: string): Promise<BaseResult> {
        if (!this.config.jobs?.length) {
            throw new Error(
                'Job actions require jobs registered via the jobs option of specification.jobs()',
            );
        }

        const job = this.config.jobs.find((j) => j.name === name);
        if (!job) {
            const available = this.config.jobs.map((j) => j.name).join(', ');
            throw new Error(`trigger("${name}"): job not found. Available: ${available}`);
        }

        await job.execute();

        return new BaseResult({
            config: this.config,
            testDir: this.testDir,
        });
    }

    /**
     * Automatic connection-URL injection (CONVENTIONS B6): `<KEY>_URL` for
     * every declared service, plus the standard aliases when unambiguous —
     * `DATABASE_URL` (exactly one SQL database) and `REDIS_URL` (exactly one
     * redis). `.env()` overrides; `null` unsets.
     */
    private serviceEnv(): CliEnv | undefined {
        const services = this.config.services;
        if (!services || Object.keys(services).length === 0) {
            return undefined;
        }

        const env: CliEnv = {};
        const sqlHandles: ServiceHandle[] = [];
        const redisHandles: ServiceHandle[] = [];
        for (const [key, handle] of Object.entries(services)) {
            // Camel-aware CONSTANT_CASE (CONVENTIONS B6): analyticsDb yields
            // ANALYTICS_DB_URL, db-main yields DB_MAIN_URL, db yields DB_URL.
            env[`${toConstantCase(key)}_URL`] = handle.connectionString;
            if (handle.createDatabaseAdapter() !== null) {
                sqlHandles.push(handle);
            }
            if (handle.type === 'redis') {
                redisHandles.push(handle);
            }
        }
        if (sqlHandles.length === 1) {
            env.DATABASE_URL = sqlHandles[0].connectionString;
        }
        if (redisHandles.length === 1) {
            env.REDIS_URL = redisHandles[0].connectionString;
        }
        return env;
    }

    private async runCommandAction(
        workDir: string,
        action: { args: string | string[]; options?: ExecOptions },
    ): Promise<CliResult> {
        if (!this.config.command) {
            throw new Error('Command actions require a command adapter');
        }

        const dockerConfig = this.config.dockerConfig;
        // The test-run id is bound to the SpecificationConfig (i.e. to
        // The runner), not to each spec. This means every spec from the
        // Same runner sees the same isolation scope — tests that spawn a
        // World in one spec and inspect/destroy it in a follow-up spec
        // See their own container, not a ghost. Vitest's fileParallelism
        // Gives each file its own process / module load, so different
        // Test files get different ids automatically.
        const testRunId = this.config.dockerTestRunId;

        // Merge order: injected service URLs, then the docker run-id env
        // Var, then user env (which always wins — null unsets).
        let env: CliEnv | undefined = this.serviceEnv();
        if (dockerConfig && testRunId) {
            env = { ...env, [dockerConfig.envVar]: testRunId };
        }
        const userEnv = this.resolveEnv(workDir);
        if (userEnv) {
            env = { ...env, ...userEnv };
        }
        let commandOutput: CliOutput;

        if (action.options) {
            commandOutput = await this.config.command.watch(
                action.args as string,
                workDir,
                action.options,
                env,
            );
        } else if (Array.isArray(action.args)) {
            commandOutput = { exitCode: 0, stderr: '', stdout: '' };
            for (const args of action.args) {
                commandOutput = await this.config.command.exec(args, workDir, env);
                if (commandOutput.exitCode !== 0) {
                    break;
                }
            }
        } else {
            commandOutput = await this.config.command.exec(action.args, workDir, env);
        }

        return new CliResult({
            commandOutput,
            config: this.config,
            dockerConfig: dockerConfig ?? undefined,
            testDir: this.testDir,
            testRunId: testRunId ?? undefined,
            transform: this.config.transform,
            workDir,
        });
    }
}

// ── Facet factories ──

function withDockerTestRunId(config: SpecificationConfig): SpecificationConfig {
    if (config.dockerConfig && !config.dockerTestRunId) {
        return {
            ...config,
            dockerTestRunId: `t-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`,
        };
    }
    return config;
}

/**
 * Create the `api` facet bound to the given adapter configuration. The test
 * file directory is auto-detected from the call stack at each chain start.
 */
export function createApiFacet(config: SpecificationConfig): ApiSpecification<string> {
    const start = (): SpecificationBuilder => new SpecificationBuilder(config, getCallerDir());

    return {
        delete: (path) => start().delete(path),
        get: (path) => start().get(path),
        headers: (headers) => start().headers(headers),
        intercept: (
            triggerOrContracts: InterceptContract | InterceptContract[] | InterceptTrigger,
            response?: InterceptResponder | InterceptResponse | string,
        ) =>
            Array.isArray(triggerOrContracts)
                ? start().intercept(triggerOrContracts)
                : start().intercept(
                      triggerOrContracts as InterceptTrigger,
                      response as InterceptResponder | InterceptResponse | string,
                  ),
        post: (path, body) => start().post(path, body),
        put: (path, body) => start().put(path, body),
        request: (file) => start().request(file),
        seed: (file, options) => start().seed(file, options),
    };
}

/**
 * Create the `jobs` facet bound to the given adapter configuration.
 */
export function createJobsFacet(config: SpecificationConfig): JobsSpecification<string> {
    const start = (): SpecificationBuilder => new SpecificationBuilder(config, getCallerDir());

    return {
        intercept: (
            triggerOrContracts: InterceptContract | InterceptContract[] | InterceptTrigger,
            response?: InterceptResponder | InterceptResponse | string,
        ) =>
            Array.isArray(triggerOrContracts)
                ? start().intercept(triggerOrContracts)
                : start().intercept(
                      triggerOrContracts as InterceptTrigger,
                      response as InterceptResponder | InterceptResponse | string,
                  ),
        seed: (file, options) => start().seed(file, options),
        trigger: (name) => start().trigger(name),
    };
}

/**
 * Create the `website` facet bound to the given adapter configuration.
 */
export function createWebsiteFacet(config: SpecificationConfig): WebsiteSpecification {
    const start = (): SpecificationBuilder => new SpecificationBuilder(config, getCallerDir());

    return {
        fetch: (path) => start().fetch(path),
        headers: (headers) => start().headers(headers),
        visit: (path, scenario) => start().visit(path, scenario),
    };
}

/**
 * Create the `cli` facet bound to the given adapter configuration.
 */
export function createCliFacet(config: SpecificationConfig): CliSpecification<string> {
    const resolved = withDockerTestRunId(config);
    const start = (): SpecificationBuilder => new SpecificationBuilder(resolved, getCallerDir());

    return {
        env: (env) => start().env(env),
        exec: (args, options) => start().exec(args, options),
        fixture: (path) => start().fixture(path),
        seed: (file, options) => start().seed(file, options),
    };
}
