import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';

// Type-only import — erased at runtime; the msw integration stays lazy (I1).
import type { ContractRegistration } from '../../../integrations/msw/intercept.js';
import {
    type Contract,
    type ContractInput,
    contractsOf,
    isContract,
    isContracts,
} from '../../contracts/contract.js';
import type {
    ContractRequest,
    ContractResponder,
    ContractResponse,
} from '../../contracts/types.js';
import { parseRequestFile } from '../../http-files/http-file.js';
import type { BrowserPort, VisitScenario } from '../../ports/browser.port.js';
import type { CliEnv, CliOutput, CliPort, ExecOptions } from '../../ports/cli.port.js';
import type { DatabasePort } from '../../ports/database.port.js';
import type { DevicePort, MobileScenario } from '../../ports/device.port.js';
import type { ServerPort } from '../../ports/server.port.js';
import type { ServiceHandle } from '../../ports/service.port.js';
import { HttpResult } from '../api/result.js';
import {
    type LiterateRunFlags,
    type LiterateServeRegistration,
    runLiterateSpec,
} from '../cli/literate.js';
import { CliResult } from '../cli/result.js';
import { ScreenResult } from '../mobile/result.js';
import { FetchResult, PageResult } from '../website/result.js';
import { toConstantCase } from './binding.js';
import { getCallerDir } from './caller.js';
import { copyPlan } from './fixtures.js';
import { BaseResult, validateDatabaseOption } from './result/result.js';
import type { StubBackend } from './stub-backend.js';

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
    /**
     * The declared stub backend (website/mobile facets) — armed with the
     * chain's contracts before every terminal action.
     */
    backend?: StubBackend;
    /**
     * Base URL of the running stub backend — allow-listed through the
     * browser's `external: 'block'` policy so client-side fetches reach it.
     */
    backendUrl?: string;
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
    /** Bundle id of the app under test (mobile facet only) — the app `.open()` relaunches. */
    bundleId?: string;
    command?: CliPort;
    database?: DatabasePort;
    /**
     * Keys of the declared services record that are databases. Drives the
     * CONVENTIONS A7 rule: with 2+ databases the `database` option is
     * mandatory on `.seed()` / `.table()`; with exactly one it is forbidden.
     */
    databaseKeys?: string[];
    databases?: Map<string, DatabasePort>;
    /**
     * Lazy device accessor (mobile facet only). The first `.open()` creates
     * the shared driver session; the appium/webdriverio integration stays a
     * lazy import so the optional peer is only loaded when a spec opens the
     * app.
     */
    device?: () => Promise<DevicePort>;
    dockerConfig?: DockerSpecConfig;
    /**
     * Unique id shared by every spec from this runner instance.
     * Stable for the runner's lifetime so multi-step tests (spawn in
     * one run, inspect in another) see the same container scope. The
     * facet factories auto-populate this when `dockerConfig` is present.
     */
    dockerTestRunId?: string;
    /**
     * Named environment SETS a literate `.cli` header may name by bare word
     * (`env: frozen`). Declared once per app in `specification.cli()`.
     */
    envSets?: Record<string, CliEnv>;
    /**
     * When set, `.intercept()` is unavailable on this runner and throws this
     * reason immediately (compose mode — MSW is in-process, CONVENTIONS I3).
     */
    interceptDisabledReason?: string;
    jobs?: JobHandle[];
    /** The project root — the working directory a literate `serve:` command runs from. */
    root?: string;
    server?: ServerPort;
    /**
     * Named servers a literate `.cli` header may start (`serve: mcp KEY=value`).
     * Declared once per app in `specification.cli()`.
     */
    serveRegistry?: Record<string, LiterateServeRegistration>;
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

/**
 * The `.intercept()` overload set, identical on every facet: one contract, a
 * list, a composite — or the inline `(request, response)` pair for a one-off.
 */
export type InterceptMethod<T> = ((contracts: ContractInput) => T) &
    ((request: ContractRequest, response: ContractResponder | ContractResponse) => T);

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
    /** Declare outgoing calls — a contract, a list, a composite, or an inline request + response pair. */
    intercept: InterceptMethod<ApiSpecification<DatabaseKey>>;
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
    /** Declare outgoing calls — a contract, a list, a composite, or an inline request + response pair. */
    intercept: InterceptMethod<JobsSpecification<DatabaseKey>>;
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
    /**
     * Run a literate `<case>.cli` spec — its header (fixtures, env sets,
     * servers) and every `$` block, each asserted — and resolve with the LAST
     * block's result, so a `.test.ts` can add an assertion the file cannot
     * express (a directory golden, a grep). The path is relative to the test
     * file's own directory, where the `.cli` lives.
     */
    run: (file: string, options?: LiterateRunFlags) => Promise<CliResult>;
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
    /**
     * Declare the chain's backend contracts — served by the declared stub
     * backend (requires the runner's `backend` option). Multiple calls append.
     */
    intercept: InterceptMethod<WebsiteSpecification>;

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
 * The `mobile` facet — screen chain entry handed out by
 * `specification.mobile()`. `.open()` is the single, terminal action: it
 * terminates and relaunches the app (deterministic fresh state), applies the
 * deep link, runs the scenario, and captures the final screen.
 */
export interface MobileSpecification {
    /**
     * Declare the chain's backend contracts — served by the declared stub
     * backend (requires the runner's `backend` option). Multiple calls append.
     */
    intercept: InterceptMethod<MobileSpecification>;

    /**
     * Relaunch the app and resolve with the captured screen. With a deep
     * link, the app opens on it; with a scenario, the visitor interacts
     * first (the When) and the capture reflects the FINAL screen state.
     */
    open: (deepLink?: string, scenario?: MobileScenario) => Promise<ScreenResult>;
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
        MobileSpecification,
        WebsiteSpecification
{
    private commandEnv: CliEnv = {};
    private config: SpecificationConfig;
    private contracts: Contract[] = [];
    private fixtures: FixtureEntry[] = [];
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
     * Declare the outgoing calls this chain expects, and what they reply.
     *
     * Contracts are the ONE form (CONVENTIONS D7): a single {@link Contract},
     * a list, or a `Contracts` composite — plus the inline
     * `(request, response)` pair for a one-off technical case. Multiple calls
     * append; composition and overriding live in `defineContracts()` /
     * `.with()`, not in call order.
     *
     * api/jobs chains serve them through MSW; website/mobile chains through
     * the declared stub backend. Same queue, same semantics: first matching
     * non-exhausted contract wins, no `times` means unlimited.
     *
     * @example
     *   // A composite — the artifact a test imports
     *   import newsroom from './contracts/newsroom.contracts.js';
     *   .intercept(newsroom)
     *
     *   // A scenario derived from it
     *   .intercept(newsroom.with(articleGone(id)))
     *
     *   // One contract, or a list, registered in declaration order
     *   .intercept(classifyArticle)
     *   .intercept([rateLimited, classifyArticle])
     *
     *   // Inline request + response, incl. a responder computed per request
     *   .intercept(openai.responses({ user: PROMPT }), openai.reply({ ok: true }))
     *   .intercept(http.post(url), (request) => http.json({ echoed: request.body }))
     */
    intercept(contracts: ContractInput): this;
    intercept(request: ContractRequest, response: ContractResponder | ContractResponse): this;
    intercept(
        requestOrContracts: ContractInput | ContractRequest,
        maybeResponse?: ContractResponder | ContractResponse,
    ): this {
        if (this.config.interceptDisabledReason) {
            throw new Error(`.intercept(): ${this.config.interceptDisabledReason}`);
        }

        // Website/mobile chains have no in-process network to intercept — the
        // App under test runs in its own process (server child, simulator).
        // Their contracts are served by the declared stub backend instead.
        const stubFacet = this.config.baseUrl !== undefined || this.config.device !== undefined;
        if (stubFacet && !this.config.backend) {
            const facet = this.config.device === undefined ? 'website' : 'mobile';
            throw new Error(
                `.intercept(): this runner has no declared backend — add \`backend\` to the specification options ` +
                    `(specification.${facet}({ …, backend: { … } })) so the chain's contracts have a stub to serve them.`,
            );
        }

        if (
            Array.isArray(requestOrContracts) ||
            isContracts(requestOrContracts) ||
            isContract(requestOrContracts)
        ) {
            this.contracts.push(...contractsOf(requestOrContracts));
            return this;
        }

        if (maybeResponse === undefined) {
            throw new Error(
                '.intercept(): a bare request needs its response — pass a contract ' +
                    '(defineContract({ request, response })) or the inline pair .intercept(request, response).',
            );
        }
        this.contracts.push({ request: requestOrContracts, response: maybeResponse });
        return this;
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

    /**
     * Run a literate `<case>.cli` spec and resolve with the LAST block's
     * result. The whole file runs in ONE working directory with ONE set of
     * servers, and every block is asserted — unlike `.exec([...])`, a non-zero
     * exit does not stop the sequence, because here each exit code is part of
     * what the file states.
     *
     * Setup chained BEFORE the call layers underneath the file's own header: a
     * chained `.fixture()` is copied first, the header's `fixture:` lines over
     * it, and the header's `env:` wins over a chained `.env()`.
     *
     * @example
     *   const result = await cli.run('no-estate.cli');
     *   await expect(result.directory('out')).toMatch('scaffold');
     */
    run(file: string, options?: LiterateRunFlags): Promise<CliResult> {
        const workDir = this.prepareWorkDir();
        return this.executeSetup(workDir, () => this.runLiterateAction(workDir, file, options));
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

    // ── Mobile actions (terminal) ──

    /**
     * Terminate and relaunch the app on the simulator, apply the deep link,
     * run the scenario, and resolve with the captured final screen — the
     * projected accessibility tree and the visible texts. One driver session
     * per runner; every open starts from a deterministic fresh app state.
     *
     * @example
     *   const result = await mobile.open('news://events');
     *   expect(result.screen).toMatch('events.screen.json');
     *
     *   const result = await mobile.open('news://events', async (visitor) => {
     *       await visitor.tap(button('Enquête Fauci COVID-19'));
     *       await visitor.see(content('rapports'));
     *   });
     */
    open(deepLink?: string, scenario?: MobileScenario): Promise<ScreenResult> {
        return this.executeSetup(null, () => this.runOpenAction(deepLink, scenario));
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

        // Serve the chain's contracts. Website/mobile chains have a declared
        // Stub backend — it resets between chains the way databases do: this
        // Chain's contracts replace the previous chain's and the unmatched log
        // Clears. Every other facet registers them with MSW.
        //
        // Strict either way (CONVENTIONS D7): once a chain declares at least
        // One contract, every outgoing request must match a non-exhausted one
        // — an unmatched request rejects the action promise with an explicit
        // Error. Chains with zero contracts stay unguarded (known boundary).
        let registration: ContractRegistration | null = null;
        if (this.config.backend) {
            this.config.backend.beginChain(this.contracts);
        } else if (this.contracts.length > 0) {
            const { registerContracts } = await import('../../../integrations/msw/intercept.js');
            registration = await registerContracts(this.contracts);
        }

        // Execute action
        try {
            const value = await action();
            const violation = registration?.violation() ?? this.config.backend?.violation();
            if (violation) {
                throw violation;
            }
            return value;
        } catch (error) {
            // The strict-intercept error is the actionable failure — prefer
            // It over the app-level fallout of the 501 the request received.
            throw registration?.violation() ?? this.config.backend?.violation() ?? error;
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
            allowedOrigins: this.config.backendUrl
                ? [new URL(this.config.backendUrl).origin]
                : undefined,
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

    private async runOpenAction(
        deepLink?: string,
        scenario?: MobileScenario,
    ): Promise<ScreenResult> {
        if (!this.config.device || this.config.bundleId === undefined) {
            throw new Error('.open() requires a device adapter (use specification.mobile())');
        }

        const device = await this.config.device();
        const screen = await device.open({
            bundleId: this.config.bundleId,
            deepLink,
            scenario,
        });

        return new ScreenResult({
            config: this.config,
            screen,
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

    /**
     * The environment every child of this chain starts with. Merge order:
     * injected service URLs (CONVENTIONS B6), then the docker run-id var, then
     * the chain's own `.env()` — which always wins, `null` unsetting.
     */
    private childEnv(workDir: string): CliEnv | undefined {
        let env: CliEnv | undefined = this.serviceEnv();
        const dockerConfig = this.config.dockerConfig;
        if (dockerConfig && this.config.dockerTestRunId) {
            env = { ...env, [dockerConfig.envVar]: this.config.dockerTestRunId };
        }
        const userEnv = this.resolveEnv(workDir);
        if (userEnv) {
            env = { ...env, ...userEnv };
        }
        return env;
    }

    private runLiterateAction(
        workDir: string,
        file: string,
        options?: LiterateRunFlags,
    ): Promise<CliResult> {
        const filePath = resolve(this.testDir, file);
        return runLiterateSpec({
            baseEnv: this.childEnv(workDir),
            frozen: options?.frozen,
            config: this.config,
            displayPath: relative(process.cwd(), filePath) || file,
            filePath,
            testDir: this.testDir,
            workDir,
        });
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

        const env = this.childEnv(workDir);
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

/**
 * The facet-level `.intercept()`: both overloads forwarded to a fresh chain.
 * The pair form is recognised by its second argument — a bare
 * {@link ContractRequest} never arrives alone.
 */
function interceptOn(
    start: () => SpecificationBuilder,
): (
    contractsOrRequest: ContractInput | ContractRequest,
    response?: ContractResponder | ContractResponse,
) => SpecificationBuilder {
    return (contractsOrRequest, response) =>
        response === undefined
            ? start().intercept(contractsOrRequest as ContractInput)
            : start().intercept(contractsOrRequest as ContractRequest, response);
}

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
        intercept: interceptOn(start) as ApiSpecification<string>['intercept'],
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
        intercept: interceptOn(start) as JobsSpecification<string>['intercept'],
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
        intercept: interceptOn(start) as WebsiteSpecification['intercept'],
        visit: (path, scenario) => start().visit(path, scenario),
    };
}

/**
 * Create the `mobile` facet bound to the given adapter configuration.
 */
export function createMobileFacet(config: SpecificationConfig): MobileSpecification {
    const start = (): SpecificationBuilder => new SpecificationBuilder(config, getCallerDir());

    return {
        intercept: interceptOn(start) as MobileSpecification['intercept'],
        open: (deepLink, scenario) => start().open(deepLink, scenario),
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
        run: (file, options) => start().run(file, options),
        seed: (file, options) => start().seed(file, options),
    };
}
