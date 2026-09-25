import { cpSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';

import { runSpecDocument } from '../../actions/run/literate.js';
import type { LiterateRunFlags } from '../../actions/run/literate.js';
import { declared as declaredContracts } from '../../capabilities/intercept/declared.js';
import type { InterceptMethod } from '../../capabilities/intercept/intercept.capability.js';
import type { SeedSource } from '../../capabilities/seed/seed.capability.js';
import type { ChainContext } from '../../capabilities/with/with.capability.js';
import { CallResult } from '../../results/call.result.js';
import { CliResult } from '../../results/cli.result.js';
import { ScreenResult } from '../../results/screen.result.js';
import { copyPlan } from '../../seams/fs/fixtures.js';
// Type-only import — erased at runtime; the msw integration stays lazy (I1).
import type { ContractRegistration } from '../../seams/msw/server.js';
import { stubBackend } from '../../seams/stub-backend/stub-network.js';
import type { Contract, ContractInput } from '../../stubs/contract.js';
import type { ContractRequest, ContractResponder, ContractResponse } from '../../stubs/exchange.js';
import { clock as timeClock } from '../clock/clock.js';
import type { CliEnv, CliOutput, ExecOptions } from '../ports/cli.port.js';
import type { DatabasePort } from '../ports/database.port.js';
import type { MobileScenario } from '../ports/device.port.js';
import type { ServiceHandle } from '../ports/service.port.js';
import { toConstantCase } from '../services/binding.js';
import { validateDatabaseOption } from '../services/database-option.js';
import { getCallerDir } from './caller.js';
import type { SpecificationConfig } from './config.js';
import { expandWorkdir, resolveSpecPath } from './resolve.js';
import { scratchDirectory } from './scratch.js';
import { requireDiskFile, requireDiskTarget } from './spec-path.js';
import type { DiskFile, DiskTarget } from './spec-path.js';

// ── Types ──

/** A SQL seed to execute before the action, optionally targeting a named database. */
type SeedEntry = {
    database?: string | undefined;
    /** The directory the path is read from — the spec's, or the document's that named it. */
    dir?: string | undefined;
    /** Relative to the spec file, or to the document that named it. */
    path: string;
};

// ── Facet views ──

/**
 * The `integration` facet — the in-process chain handed out by
 * `specification.integration()`.
 *
 * The subject is a MODULE, not an entry: no HTTP, no binary, no page. What
 * makes it a spec rather than a module test is what it stands on — real
 * services, declared contracts, a golden — so it takes the same setups as
 * every other facet and ends on the one action a module has: being called.
 */
export type IntegrationSpecification<
    Services extends Record<string, unknown> = Record<string, unknown>,
    DatabaseKey extends string = string,
> = {
    /** Pin the module's `Date` at `iso` for this chain. */
    clock: (iso: string) => IntegrationSpecification<Services, DatabaseKey>;
    /** Declare outgoing calls — a contract, a list, a composite, or an inline request + response pair. */
    intercept: InterceptMethod<IntegrationSpecification<Services, DatabaseKey>>;
    /** Queue a SQL seed — `file('./seeds/<name>.sql')` — to run before the call. */
    seed: (
        source: SeedSource,
        options?: { database?: DatabaseKey },
    ) => IntegrationSpecification<Services, DatabaseKey>;

    /**
     * Call the module and resolve with what it produced. The started services
     * record is handed in, so the subject is constructed with the real
     * connection strings rather than with a double.
     */
    call: <T>(subject: (services: Services) => Promise<T> | T) => Promise<CallResult<T>>;
    /** The facet with the clock a whole file shares, every chain it starts pinned at it. */
    with: (context: Pick<ChainContext, 'clock'>) => IntegrationSpecification<Services, DatabaseKey>;
};

/**
 * The `cli` facet — command chain entry handed out by `specification.cli()`.
 * Setup methods chain; `.exec()` is the single terminal action (CONVENTIONS
 * B2) — `{ waitFor?, timeout? }` covers long-running processes.
 */
export type CliSpecification<DatabaseKey extends string = string> = {
    /** Set environment variables on the child process. `$WORKDIR` expands; `null` unsets. */
    env: (env: CliEnv) => CliSpecification<DatabaseKey>;
    /**
     * Lay file state into the working directory before execution: a
     * `directory()`'s CONTENTS are spread into it, a `file()` is copied under
     * its own name. The shared pool is reached by the path that climbs to it.
     * Chained calls layer.
     */
    fixture: (source: DiskTarget) => CliSpecification<DatabaseKey>;
    /** Queue a SQL seed — `file('./seeds/<name>.sql')` — to run against a database before the action. */
    seed: (
        source: SeedSource,
        options?: { database?: DatabaseKey },
    ) => CliSpecification<DatabaseKey>;

    /**
     * Execute the command (or sequence of commands) and resolve with the
     * result. Called with no arguments (`cli.exec()`), the binary runs bare —
     * no CLI arguments. With `{ waitFor, timeout }`, the process is
     * long-running: it resolves when the pattern appears and is killed at the
     * timeout.
     */
    exec: (args?: string | string[], options?: ExecOptions) => Promise<CliResult>;
    /**
     * Run a `<case>.spec.yaml` document — its ground (fixtures, env sets,
     * servers) and every run, each asserted — and resolve with the LAST run's
     * result, so a `.test.ts` can add an assertion the document cannot express
     * (a directory golden, a grep). The document is named with `file()`, from
     * the test file beside it.
     */
    run: (document: DiskFile<'.spec.yaml'>, options?: LiterateRunFlags) => Promise<CliResult>;
    /** The facet with the environment a whole file shares, every command it runs starting from it. */
    with: (context: Pick<ChainContext, 'env'>) => CliSpecification<DatabaseKey>;
};

/**
 * The `mobile` facet — screen chain entry handed out by
 * `specification.mobile()`. `.open()` is the single, terminal action: it
 * terminates and relaunches the app (deterministic fresh state), applies the
 * deep link, runs the scenario, and captures the final screen.
 */
export type MobileSpecification = {
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
};

/**
 * Fluent builder for declaring a single test specification.
 *
 * Chain setup methods ({@link seed}, {@link fixture}, {@link env}), then call
 * an action ({@link get}, {@link post}, {@link exec}, {@link call}) —
 * actions are terminal: they execute the specification and resolve to a
 * typed result.
 *
 * Facets expose this class through the narrower {@link CliSpecification}
 * view and its siblings so each facet
 * only surfaces the methods that make sense for it.
 */
export class SpecificationBuilder
    implements CliSpecification, IntegrationSpecification, MobileSpecification
{
    private pinnedClock: null | string = null;
    private commandEnv: CliEnv = {};
    private readonly config: SpecificationConfig;
    private readonly contracts: Contract[] = [];
    private readonly fixtures: DiskTarget[] = [];
    private readonly seeds: SeedEntry[] = [];
    private readonly testDir: string;

    constructor(config: SpecificationConfig, testDir: string) {
        this.config = config;
        this.testDir = testDir;
    }

    // ── Setup ──

    /**
     * Pin the clock at `iso` for this chain.
     *
     * An in-process facet (integration) pins the runner's own `Date`, which is
     * the module's, released when the action resolves, so a chain never leaks
     * its instant into the next one (CONVENTIONS D16).
     *
     * @example
     *   const result = await integration.clock('2026-03-04T09:30:00Z').call(() => now());
     */
    clock(iso: string): this {
        this.pinnedClock = iso;
        return this;
    }

    /**
     * Queue a SQL seed to run before the action: a `.sql` file named with
     * `file()` — beside the test in `./seeds/` when it alone reads it, at the
     * level of its readers when several share it.
     *
     * With two or more declared databases the `database` option is mandatory;
     * with exactly one it is forbidden (CONVENTIONS A7).
     *
     * @example
     *   api.seed(file('./seeds/ada.sql'), { database: 'db' }).get('/users');
     *   api.seed(file('../../shared/seeds/users.sql'), { database: 'db' }).get('/users');
     */
    seed(source: SeedSource, options?: { database?: string }): this {
        const { path } = requireDiskFile('seed', source, '.sql');
        validateDatabaseOption('seed', this.config, options?.database);
        this.seeds.push({ database: options?.database, path });
        return this;
    }

    /**
     * Lay file state into the working directory before execution: a
     * `directory()`'s contents are spread into it, a `file()` is copied under
     * its own name. Chained fixtures layer in order — a later one overwrites
     * files written by an earlier one.
     *
     * @example
     *   cli.fixture(directory('../../shared/fixtures/cli-app/')).exec('build');   // the shared pool
     *   cli.fixture(file('./fixtures/config.toml')).exec('migrate');
     */
    fixture(source: DiskTarget): this {
        this.fixtures.push(requireDiskTarget('fixture', source));
        return this;
    }

    /**
     * Set environment variables for the command process. Merged on top of process.env.
     * Use `null` to unset a variable. Multiple calls merge.
     *
     * The token `$WORKDIR` (in any value) is replaced at run-time with the
     * spec's working directory in its resolved form — the same string
     * `{{workdir}}` asserts against — so a path handed to the child comes back
     * matchable. Useful for tests that need a fully isolated `HOME`.
     *
     * @example
     *   cli.env({ HOME: "$WORKDIR", TZ: "UTC" }).exec("status");
     */
    env(env: CliEnv): this {
        this.commandEnv = { ...this.commandEnv, ...env };
        return this;
    }

    /**
     * Start from what a whole file shares: its clock, its environment — each
     * as its own setup would state it, so a later setup of the chain
     * overrides or merges exactly as it would over an earlier one.
     *
     * @example
     *   const tools = cli.with({ env: { TZ: 'UTC' } });
     *   await tools.exec('status');
     */
    with({ clock, env }: ChainContext): this {
        if (clock !== undefined) {
            this.clock(clock);
        }
        if (env !== undefined) {
            this.env(env);
        }
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
     * An integration chain serves them through MSW; a mobile chain through
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
        // A mobile chain has no in-process network to intercept — the app
        // Runs on the simulator. Its contracts are served by the declared
        // Stub backend instead.
        if (this.config.device !== undefined) {
            stubBackend(this.config.backend, 'mobile').accepts();
        }

        this.contracts.push(...declaredContracts('.intercept', requestOrContracts, maybeResponse));
        return this;
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
    async exec(args: string | string[] = '', options?: ExecOptions): Promise<CliResult> {
        if (Array.isArray(args) && args.length === 0) {
            throw new Error('exec([]) requires at least one command');
        }
        if (options && Array.isArray(args)) {
            throw new Error(
                '.exec(): waitFor/timeout options are not supported with a command sequence',
            );
        }
        return await this.executeCommand({ args, options });
    }

    /**
     * Run a `<case>.spec.yaml` document and resolve with the LAST run's
     * result. The whole file executes in ONE working directory with ONE set of
     * servers, and every run is asserted — unlike `.exec([...])`, a non-zero
     * exit does not stop the sequence, because here each exit code is part of
     * what the document states.
     *
     * Setup chained BEFORE the call layers underneath the document's own
     * ground: a chained fixture is copied first, the document's `fixture:`
     * entries over it, and its `env:` wins over a chained `.env()`.
     *
     * @example
     *   const result = await cli.run(file('./no-estate.spec.yaml'));
     *   await expect(result.directory('out')).toMatch(directory('./expected/scaffold/'));
     */
    async run(document: DiskFile<'.spec.yaml'>, options?: LiterateRunFlags): Promise<CliResult> {
        const source = requireDiskFile('run', document, '.spec.yaml');
        const workDir = this.prepareWorkDir();
        return await this.executeSetup(
            workDir,
            async () => await this.runLiterateAction(workDir, source.path, options),
        );
    }

    // ── Mobile actions (terminal) ──

    /**
     * Terminate and relaunch the app on the simulator, apply the deep link,
     * run the scenario, and resolve with the captured final screen — the
     * projected accessibility tree and the visible texts. The driver session
     * is the run's under a `mobile()` project whose Appium server outlives the
     * file — a declared one, or the one its global setup spawned — and the
     * runner's otherwise; every open starts from a deterministic fresh app
     * state.
     *
     * @example
     *   const result = await mobile.open('news://events');
     *   expect(result.screen).toMatch(file('./expected/events.screen.json'));
     *
     *   const result = await mobile.open('news://events', async (visitor) => {
     *       await visitor.tap(button('Enquête Fauci COVID-19'));
     *       await visitor.see(content('rapports'));
     *   });
     */
    async open(deepLink?: string, scenario?: MobileScenario): Promise<ScreenResult> {
        return await this.executeSetup(
            null,
            async () => await this.runOpenAction(deepLink, scenario),
        );
    }

    // ── Integration actions (terminal) ──

    /**
     * Call the module under test and resolve with what it produced — the
     * value it returned, or the error it threw.
     *
     * A refusal is a reading, never a `try`/`catch`: `result.error` carries
     * what was thrown, and `result.value` what was returned. That is what
     * keeps a spec of a refusal the same size as a spec of a success, and
     * what stops a "it should throw" spec from passing when nothing does.
     *
     * @example
     *   const result = await integration
     *       .seed(file('./seeds/rows.sql'))
     *       .call(({ db }) => find(db.connectionString, id));
     *   expect(result.value).toMatch(file('./expected/found.json'));
     */
    async call<T>(subject: (services: never) => Promise<T> | T): Promise<CallResult<T>> {
        return await this.executeSetup(null, async () => await this.runCallAction(subject));
    }

    // ── Private execution pipeline ──

    private async executeCommand(action: {
        args: string | string[];
        options?: ExecOptions | undefined;
    }): Promise<CliResult> {
        const workDir = this.prepareWorkDir();
        return await this.executeSetup(
            workDir,
            async () => await this.runCommandAction(workDir, action),
        );
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

            await db.seed(
                readFileSync(
                    resolveSpecPath('seed', entry.path, entry.dir ?? this.testDir),
                    'utf8',
                ),
            );
        }

        // Copy fixtures into the working directory, layered in chain order —
        // A later fixture overwrites an earlier file.
        if (this.fixtures.length > 0 && workDir) {
            for (const entry of this.fixtures) {
                const { dest, src } = copyPlan(entry.path, this.testDir, workDir);
                cpSync(src, dest, { recursive: true });
            }
        }

        // Serve the chain's contracts. A mobile chain has a declared
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
            const { registerContracts } = await import('../../seams/msw/server.js');
            registration = await registerContracts(this.contracts);
        }

        // Pin the in-process calendar for the action alone.
        const instant = this.pinnedClock;
        const pinned = instant === null ? null : timeClock.at(instant);

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
            pinned?.[Symbol.dispose]();
            registration?.cleanup();
        }
    }

    // ── Private ──

    private resolveEnv(workDir: string): CliEnv | undefined {
        if (Object.keys(this.commandEnv).length === 0) {
            return undefined;
        }
        return expandWorkdir(this.commandEnv, workDir);
    }

    private prepareWorkDir(): string {
        // Every command spec runs in a fresh, empty temp directory. Fixtures
        // Are layered in afterwards via .fixture() (see executeSetup) — the
        // Runner never writes into the source tree.
        return scratchDirectory('spec-command-');
    }

    private async runCallAction<T>(
        subject: (services: never) => Promise<T> | T,
    ): Promise<CallResult<T>> {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the record's TYPE is the constructor's type parameter, which this shared builder has no way to carry; the facet's signature is what the spec sees
        const services = (this.config.services ?? {}) as never;
        let outcome: { error: unknown; threw: boolean; value: unknown };
        try {
            outcome = { error: null, threw: false, value: await subject(services) };
        } catch (error) {
            // The refusal IS the reading. Rethrowing here would put a
            // `try`/`catch` back in every spec of a module that says no.
            outcome = { error, threw: true, value: null };
        }
        return new CallResult({ config: this.config, outcome, testDir: this.testDir });
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

    /**
     * Automatic connection-URL injection (CONVENTIONS B6): `<KEY>_URL` for
     * every declared service, plus the standard aliases when unambiguous —
     * `DATABASE_URL` (exactly one SQL database) and `REDIS_URL` (exactly one
     * redis). `.env()` overrides; `null` unsets.
     */
    private serviceEnv(): CliEnv | undefined {
        const { services } = this.config;
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
        const [onlySql] = sqlHandles;
        if (sqlHandles.length === 1 && onlySql !== undefined) {
            env.DATABASE_URL = onlySql.connectionString;
        }
        const [onlyRedis] = redisHandles;
        if (redisHandles.length === 1 && onlyRedis !== undefined) {
            env.REDIS_URL = onlyRedis.connectionString;
        }
        return env;
    }

    /**
     * The environment every child of this chain starts with. Merge order:
     * injected service URLs (CONVENTIONS B6), then the docker run-id var, then
     * the chain's own `.env()` — which always wins, `null` unsetting.
     */
    private childEnv(workDir: string): CliEnv | undefined {
        const declared = this.config.defaultEnv;
        let env: CliEnv | undefined = declared
            ? { ...expandWorkdir(declared, workDir), ...this.serviceEnv() }
            : this.serviceEnv();
        const { dockerConfig } = this.config;
        if (dockerConfig && this.config.dockerTestRunId) {
            env = { ...env, [dockerConfig.envVar]: this.config.dockerTestRunId };
        }
        const userEnv = this.resolveEnv(workDir);
        if (userEnv) {
            env = { ...env, ...userEnv };
        }
        return env;
    }

    private async runLiterateAction(
        workDir: string,
        document: string,
        options?: LiterateRunFlags,
    ): Promise<CliResult> {
        const filePath = resolveSpecPath('run', document, this.testDir);
        return await runSpecDocument({
            baseEnv: this.childEnv(workDir),
            frozen: options?.frozen,
            config: this.config,
            displayPath: relative(process.cwd(), filePath) || document,
            filePath,
            testDir: this.testDir,
            workDir,
        });
    }

    private async runCommandAction(
        workDir: string,
        action: { args: string | string[]; options?: ExecOptions | undefined },
    ): Promise<CliResult> {
        if (!this.config.command) {
            throw new Error('Command actions require a command adapter');
        }

        const { dockerConfig } = this.config;
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
 * Create the `integration` facet bound to the given adapter configuration.
 */
export function createIntegrationFacet<
    Services extends Record<string, unknown>,
    DatabaseKey extends string,
>(config: SpecificationConfig): IntegrationSpecification<Services, DatabaseKey> {
    return integrationFacet(() => new SpecificationBuilder(config, getCallerDir()));
}

/** The integration facet over a chain start. */
function integrationFacet<Services extends Record<string, unknown>, DatabaseKey extends string>(
    start: () => SpecificationBuilder,
): IntegrationSpecification<Services, DatabaseKey> {
    return {
        call: async (subject) => await start().call(subject),
        clock: (iso) => start().clock(iso),
        intercept: interceptOn(start),
        seed: (source, options) => start().seed(source, options),
        with: (context) => integrationFacet(() => start().with(context)),
    };
}

/**
 * Create the `mobile` facet bound to the given adapter configuration.
 */
export function createMobileFacet(config: SpecificationConfig): MobileSpecification {
    const start = (): SpecificationBuilder => new SpecificationBuilder(config, getCallerDir());

    return {
        intercept: interceptOn(start),
        open: async (deepLink, scenario) => await start().open(deepLink, scenario),
    };
}

/**
 * Create the `cli` facet bound to the given adapter configuration.
 */
export function createCliFacet(config: SpecificationConfig): CliSpecification {
    const resolved = withDockerTestRunId(config);
    return cliFacet(() => new SpecificationBuilder(resolved, getCallerDir()));
}

/** The cli facet over a chain start. */
function cliFacet(start: () => SpecificationBuilder): CliSpecification {
    return {
        env: (env) => start().env(env),
        exec: async (args, options) => await start().exec(args, options),
        fixture: (source) => start().fixture(source),
        run: async (document, options) => await start().run(document, options),
        seed: (source, options) => start().seed(source, options),
        with: (context) => cliFacet(() => start().with(context)),
    };
}
