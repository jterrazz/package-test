import type { ContractRequest, ContractResponseValue } from './types.js';

/**
 * A declared external interaction: what to match (`request`) and what to reply
 * (`response`), together in one named artifact. Contracts live in TypeScript
 * files under `contracts/` next to the tests that use them, so the business
 * payload (prompts, JSON responses) is visible at a glance while the real HTTP
 * call stays mocked underneath.
 */
export interface Contract {
    /** Which outgoing call this contract speaks for. */
    request: ContractRequest;
    /**
     * The reply — a fixed {@link ContractResponse}, or a function
     * `(request) => ContractResponse` evaluated per served request when the
     * response must derive from the incoming payload.
     */
    response: ContractResponseValue;
    /**
     * How many times this contract may serve. Omitted = unlimited (a
     * re-render or a retry replays it). `n` = exhausted after n serves, so an
     * ordered sequence is a finite contract followed by an unlimited tail.
     */
    times?: number;
    /**
     * When true, the chain FAILS unless the contract was actually requested:
     * at least once, or exactly `times` times when `times` is set. Turns a
     * silently-unused declaration into a spec failure.
     */
    required?: boolean;
}

/**
 * A composite of contracts — the unit tests import. Flat, ordered, immutable;
 * `.with()` derives a variant without touching the original.
 */
export interface Contracts {
    /** The flattened contracts, in selection order. */
    readonly contracts: readonly Contract[];
    /**
     * Derive a new composite: every base contract sharing a route with an
     * override is REPLACED, and the overrides are PREPENDED — so a
     * more-specific override wins first-match selection over a generic base
     * route it does not replace.
     */
    with: (...overrides: (Contract | Contract[] | Contracts)[]) => Contracts;
}

/** Any accepted contract input: one, a list, or a composite. */
export type ContractInput = Contract | Contract[] | Contracts;

/**
 * Declare one contract. Identity function — its value is the enforced shape
 * and the naming convention:
 *
 * @example
 *   // specs/api/reports/contracts/openai/classify-article.ts
 *   import { defineContract, openai } from '@jterrazz/test';
 *
 *   export default defineContract({
 *       request: openai.responses({ user: PROMPT, tools: ['classify'] }),
 *       response: openai.reply({ categories: ['TECH'] }),
 *   });
 *
 *   // Dynamic — the response is computed from the observed request:
 *   export default defineContract({
 *       request: http.post('https://api.example.com/echo'),
 *       response: (request) => http.json({ received: request.body }),
 *   });
 */
export function defineContract(contract: Contract): Contract {
    return contract;
}

/** Is this a {@link Contracts} composite (rather than a contract or a list)? */
export function isContracts(value: unknown): value is Contracts {
    return (
        typeof value === 'object' &&
        value !== null &&
        Array.isArray((value as Contracts).contracts) &&
        typeof (value as Contracts).with === 'function'
    );
}

/** Is this a single {@link Contract} (rather than a bare request half)? */
export function isContract(value: unknown): value is Contract {
    return typeof value === 'object' && value !== null && 'request' in value && 'response' in value;
}

/**
 * The route a contract claims — method + the DECLARED url source. Two
 * contracts share a route when they would be written on the same line of a
 * declaration: same method, same url pattern (`.source` for a RegExp).
 */
export function routeKeyOf(contract: Contract): string {
    const { method, url } = contract.request;
    return url instanceof RegExp ? `${method} re:${url.source}` : `${method} str:${url}`;
}

/** Human-readable route of a contract — used in every failure message. */
export function describeRoute(contract: Contract): string {
    const { method, url } = contract.request;
    return `${method === '*' ? 'ANY' : method} ${url instanceof RegExp ? String(url) : url}`;
}

/** Flatten contracts, lists, and composites into one ordered list. */
function flatten(items: readonly ContractInput[]): Contract[] {
    const flat: Contract[] = [];
    for (const item of items) {
        if (Array.isArray(item)) {
            flat.push(...flatten(item));
        } else if (isContracts(item)) {
            flat.push(...item.contracts);
        } else {
            flat.push(item);
        }
    }
    return flat;
}

/**
 * Compose contracts into the artifact a test imports — it's contracts all the
 * way down: a composite may extend contracts, lists, and other composites,
 * recursively, order preserved.
 *
 * `.with(...)` derives a scenario: contracts whose route the overrides claim
 * are removed from the base, and the overrides are prepended. Under
 * first-match selection a more specific override (`/articles/gone-1`) also
 * wins over a generic base route (`/articles/{{uuid}}`) it does not replace.
 *
 * @example
 *   // contracts/newsroom.contracts.ts
 *   export default defineContracts(events, articleById);
 *   export const withArticleGone = (id: string) =>
 *       newsroom.with(articleGone(id));
 */
export function defineContracts(...items: ContractInput[]): Contracts {
    const contracts = Object.freeze(flatten(items));
    return {
        contracts,
        with(...overrides: ContractInput[]): Contracts {
            const added = flatten(overrides);
            const claimed = new Set(added.map(routeKeyOf));
            const kept = contracts.filter((contract) => !claimed.has(routeKeyOf(contract)));
            return defineContracts([...added, ...kept]);
        },
    };
}

/** Normalize any accepted input into a flat contract list. */
export function contractsOf(input: ContractInput): Contract[] {
    return flatten([input]);
}
