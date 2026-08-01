/**
 * The ONE contract queue — pure, engine-agnostic (no MSW, no node:http).
 * Both engines consume it: the MSW integration on api/jobs chains, and the
 * declared stub backend on website/mobile chains.
 *
 * Selection: the FIRST contract in declaration order that matches the observed
 * request and is not exhausted. A contract with no `times` is unlimited (a
 * re-render or a retry replays it); `times: n` is spent after n serves, so an
 * ordered sequence is written as finite contracts before an unlimited tail:
 * `[error500 ×3, ok]`.
 *
 * Strictness (CONVENTIONS D7): when nothing matches — including "everything
 * that matches is exhausted" — the engine answers 501, records the request,
 * and the chain fails with {@link ContractQueue.unmatchedError}. A chain that
 * declared zero contracts is not guarded at all (unchanged boundary).
 */

import { CaptureScope } from '../matching/match.js';
import { hasPlaceholders, placeholderPatternSource, textEquals } from '../matching/structural.js';
import { type Contract, describeRoute } from './contract.js';
import type { MatchableRequest } from './types.js';

/** Base used to parse origin-relative observed URLs (`/events?x=1`). */
const RELATIVE_BASE = 'http://contract.invalid';

/** Split a declared url into its base (origin+path, or path) and query halves.
 * Never through `new URL()`, which would percent-encode `{{token}}` braces. */
function splitDeclared(url: string): { base: string; query: URLSearchParams } {
    const separator = url.indexOf('?');
    if (separator === -1) {
        return { base: url, query: new URLSearchParams() };
    }
    return { base: url.slice(0, separator), query: new URLSearchParams(url.slice(separator + 1)) };
}

/** Decode percent-escapes, falling back to the raw text on malformed input. */
function safeDecode(text: string): string {
    try {
        return decodeURIComponent(text);
    } catch {
        return text;
    }
}

/** Token-aware comparison of one declared value against an observed one. */
function valueMatches(declared: string, observed: string): boolean {
    return textEquals(declared, observed, new CaptureScope());
}

/**
 * Does an observed URL satisfy a declared one? A RegExp tests the full URL; a
 * PATH FORM (`/articles/{{uuid}}`) ignores the origin; an absolute string
 * compares origin+pathname. In both string forms `{{token}}` segments compare
 * structurally and declared query params are a SUBSET of the observed ones.
 */
export function urlMatches(declared: RegExp | string, observed: string): boolean {
    if (declared instanceof RegExp) {
        return declared.test(observed);
    }

    let url: URL;
    try {
        url = new URL(observed, RELATIVE_BASE);
    } catch {
        return false;
    }

    const { base, query } = splitDeclared(declared);
    const observedBase = base.startsWith('/') ? url.pathname : `${url.origin}${url.pathname}`;
    const decodedBase = base.startsWith('/')
        ? safeDecode(url.pathname)
        : `${url.origin}${safeDecode(url.pathname)}`;
    if (!valueMatches(base, observedBase) && !valueMatches(base, decodedBase)) {
        return false;
    }

    for (const key of new Set(query.keys())) {
        const observedValues = url.searchParams.getAll(key);
        const everyDeclaredFound = query
            .getAll(key)
            .every((value) => observedValues.some((actual) => valueMatches(value, actual)));
        if (!everyDeclaredFound) {
            return false;
        }
    }

    return true;
}

/**
 * Does an observed request satisfy a contract? Method (`*` matches any), URL,
 * then the contract's own `match` predicate (headers/query/body filters).
 */
export function contractMatches(contract: Contract, request: MatchableRequest): boolean {
    const { match, method, url } = contract.request;
    if (method !== '*' && method.toUpperCase() !== request.method.toUpperCase()) {
        return false;
    }
    if (!urlMatches(url, request.url)) {
        return false;
    }
    return match ? match(request) : true;
}

/**
 * The URL pattern an out-of-process router (MSW) must register so the request
 * REACHES the queue. Deliberately no narrower than {@link contractMatches} —
 * the predicate above stays the authority on what actually matches.
 */
export function routePatternOf(declared: RegExp | string): RegExp | string {
    if (declared instanceof RegExp) {
        return declared;
    }
    const { base } = splitDeclared(declared);
    if (base.startsWith('/')) {
        return new RegExp(
            String.raw`^https?:\/\/[^/?#]+${placeholderPatternSource(base)}(?:\?[^#]*)?(?:#.*)?$`,
        );
    }
    if (hasPlaceholders(base)) {
        return new RegExp(String.raw`^${placeholderPatternSource(base)}(?:\?[^#]*)?(?:#.*)?$`);
    }
    return base;
}

/** One route to register with an out-of-process router. */
export interface ContractRoute {
    methods: string[];
    url: RegExp | string;
}

export class ContractQueue {
    private readonly contracts: readonly Contract[];
    private readonly served: number[];

    constructor(contracts: readonly Contract[]) {
        this.contracts = contracts;
        this.served = contracts.map(() => 0);
    }

    /** How many contracts the chain declared. */
    get size(): number {
        return this.contracts.length;
    }

    /**
     * Routes to register with an out-of-process router, deduped by pattern —
     * two contracts on the same URL share one handler and one queue.
     */
    get routes(): ContractRoute[] {
        const routes = new Map<string, ContractRoute>();
        for (const contract of this.contracts) {
            const url = routePatternOf(contract.request.url);
            const key = String(url);
            const route = routes.get(key) ?? { methods: [], url };
            if (!route.methods.includes(contract.request.method)) {
                route.methods.push(contract.request.method);
            }
            routes.set(key, route);
        }
        return [...routes.values()];
    }

    /** The declared routes, in order — the enumeration a 501 body carries. */
    declaredRoutes(): string[] {
        return this.contracts.map((contract) => describeRoute(contract));
    }

    /**
     * Serve the first contract in declaration order that matches and is not
     * exhausted, or null when nothing matches (including "everything that
     * matches is spent") — the strict-violation signal.
     */
    take(request: MatchableRequest): Contract | null {
        for (let i = 0; i < this.contracts.length; i++) {
            const contract = this.contracts[i];
            const { times } = contract;
            if (times !== undefined && this.served[i] >= times) {
                continue;
            }
            if (!contractMatches(contract, request)) {
                continue;
            }
            this.served[i] += 1;
            return contract;
        }
        return null;
    }

    /**
     * The chain-end failure for contracts declared `required: true` that were
     * never requested (or not exactly `times` times), or null when every
     * requirement held.
     */
    requiredError(): Error | null {
        const unmet: string[] = [];
        for (const [i, contract] of this.contracts.entries()) {
            if (!contract.required) {
                continue;
            }
            const served = this.served[i];
            const { times } = contract;
            if (times === undefined) {
                if (served === 0) {
                    unmet.push(
                        `  - ${describeRoute(contract)} — declared and required but never requested`,
                    );
                }
            } else if (served !== times) {
                unmet.push(
                    `  - ${describeRoute(contract)} — declared required with times: ${times} but was requested ${served} time(s)`,
                );
            }
        }
        if (unmet.length === 0) {
            return null;
        }
        return new Error(
            `Required contract(s) never satisfied during the chain:\n${unmet.join('\n')}\n` +
                `A required contract states the call MUST happen — either the code no longer makes it, ` +
                `or the contract no longer describes it.`,
        );
    }

    /**
     * The strict failure for a request that matched no contract (CONVENTIONS
     * D7): method + URL of the offending request, plus every declared contract
     * and how often it was served.
     */
    unmatchedError(method: string, url: string): Error {
        const declared =
            this.contracts.length === 0
                ? '  (no contracts declared)'
                : this.contracts
                      .map((contract, i) => `  - ${describeRoute(contract)}${this.stateOf(i)}`)
                      .join('\n');
        return new Error(
            `Unmatched outgoing HTTP request during spec: ${method} ${url}\n` +
                `Declared contracts:\n${declared}\n` +
                `Every outgoing request of a chain that declares contracts must match one — ` +
                `add a contract for it (or raise its \`times\` when it is exhausted).`,
        );
    }

    private stateOf(index: number): string {
        const served = this.served[index];
        const { times } = this.contracts[index];
        if (times !== undefined && served >= times) {
            return ` (exhausted after ${times})`;
        }
        return served === 0 ? '' : ` (served ${served} time(s))`;
    }
}
