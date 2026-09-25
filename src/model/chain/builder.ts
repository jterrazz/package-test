import { readFileSync } from 'node:fs';

import { declared as declaredContracts } from '../../capabilities/intercept/declared.js';
import type { InterceptMethod } from '../../capabilities/intercept/intercept.capability.js';
import type { SeedSource } from '../../capabilities/seed/seed.capability.js';
import type { ChainContext } from '../../capabilities/with/with.capability.js';
import { ScreenResult } from '../../results/screen.result.js';
// Type-only import — erased at runtime; the msw integration stays lazy (I1).
import type { ContractRegistration } from '../../seams/msw/server.js';
import { stubBackend } from '../../seams/stub-backend/stub-network.js';
import type { Contract, ContractInput } from '../../stubs/contract.js';
import type { ContractRequest, ContractResponder, ContractResponse } from '../../stubs/exchange.js';
import { clock as timeClock } from '../clock/clock.js';
import type { DatabasePort } from '../ports/database.port.js';
import type { MobileScenario } from '../ports/device.port.js';
import { validateDatabaseOption } from '../services/database-option.js';
import { getCallerDir } from './caller.js';
import type { SpecificationConfig } from './config.js';
import { resolveSpecPath } from './resolve.js';
import { isDiskDirectory, isDiskFile, requireDiskFile } from './spec-path.js';
import type { DiskFile } from './spec-path.js';

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
 * Chain setup methods ({@link seed}, {@link headers}), then call an action
 * ({@link get}, {@link post}, {@link visit}) — actions are terminal: they
 * execute the specification and resolve to a typed result.
 *
 * Facets expose this class through the narrower {@link MobileSpecification}
 * view so it only surfaces the methods that make sense for it.
 */
export class SpecificationBuilder implements MobileSpecification {
    private pinnedClock: null | string = null;
    private readonly config: SpecificationConfig;
    private readonly contracts: Contract[] = [];
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
     * The pin is released when the action resolves, so a chain never leaks
     * its instant into the next one (CONVENTIONS D16).
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
     * Start from what a whole file shares — its clock, as its own setup would
     * state it, so a later setup of the chain overrides it.
     */
    with({ clock }: ChainContext): this {
        if (clock !== undefined) {
            this.clock(clock);
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
        return await this.executeSetup(async () => await this.runOpenAction(deepLink, scenario));
    }

    // ── Private execution pipeline ──

    /**
     * Shared setup pipeline: reset databases, run seeds, register intercepts
     * — then run the action and clean up intercepts.
     */
    private async executeSetup<T>(action: () => Promise<T>): Promise<T> {
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
