import { readFileSync } from 'node:fs';

import { declared as declaredContracts } from '../../capabilities/intercept/declared.js';
import type { SeedSource } from '../../capabilities/seed/seed.capability.js';
import type { ChainContext } from '../../capabilities/with/with.capability.js';
// Type-only import — erased at runtime; the msw integration stays lazy (I1).
import type { ContractRegistration } from '../../seams/msw/server.js';
import type { Contract, ContractInput } from '../../stubs/contract.js';
import type { ContractRequest, ContractResponder, ContractResponse } from '../../stubs/exchange.js';
import { clock as timeClock } from '../clock/clock.js';
import type { DatabasePort } from '../ports/database.port.js';
import { validateDatabaseOption } from '../services/database-option.js';
import type { SpecificationConfig } from './config.js';
import { resolveSpecPath } from './resolve.js';
import { requireDiskFile } from './spec-path.js';

// ── Types ──

/** A SQL seed to execute before the action, optionally targeting a named database. */
type SeedEntry = {
    database?: string | undefined;
    /** The directory the path is read from — the spec's, or the document's that named it. */
    dir?: string | undefined;
    /** Relative to the spec file, or to the document that named it. */
    path: string;
};

/**
 * The setups a chain declared — clock, seed, intercept, with — and the
 * pipeline that arms them around an action.
 *
 * No facet hands it out: every facet is a composition
 * (`src/facets/<facet>/<facet>.facet.ts`) over the kernel's pipeline.
 */
export class SpecificationBuilder {
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
     * Served through MSW, or through the declared stub backend when the
     * runner has one. Same queue, same semantics: first matching
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
        this.contracts.push(...declaredContracts('.intercept', requestOrContracts, maybeResponse));
        return this;
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

        // Serve the chain's contracts. A declared
        // Stub backend resets between chains the way databases do: this
        // Chain's contracts replace the previous chain's and the unmatched log
        // Clears. Without one they are registered with MSW.
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
}
