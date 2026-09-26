/** The first unexhausted stub in declaration order answers; `times: n` is spent after n serves. No match is a 501 and the chain fails (`network-strict-after-first-stub`); a chain of zero stubs is unguarded. */

import { refusal } from '../../../../lint/index.refusal.js';
import { CaptureScope } from '../../../expectations/tokens/match.js';
import {
    hasPlaceholders,
    placeholderPatternSource,
    textEquals,
} from '../../../expectations/tokens/structural.js';
import { describeRoute } from '../stub.js';
import type { Stub } from '../stub.js';
import type { MatchableRequest } from './exchange.js';

const RELATIVE_BASE = 'http://stub.invalid';

/** Never through `new URL()`, which would percent-encode `{{token}}` braces. */
function splitDeclared(url: string): { base: string; query: URLSearchParams } {
    const separator = url.indexOf('?');
    if (separator === -1) {
        return { base: url, query: new URLSearchParams() };
    }
    return { base: url.slice(0, separator), query: new URLSearchParams(url.slice(separator + 1)) };
}

function safeDecode(text: string): string {
    try {
        return decodeURIComponent(text);
    } catch {
        return text;
    }
}

function valueMatches(declared: string, observed: string): boolean {
    return textEquals(declared, observed, new CaptureScope());
}

/** A RegExp tests the full URL, a path form ignores the origin; `{{token}}` segments compare structurally and declared query params are a subset. */
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

export function stubMatches(stub: Stub, request: MatchableRequest): boolean {
    const { match, method, url } = stub.request;
    if (method !== '*' && method.toUpperCase() !== request.method.toUpperCase()) {
        return false;
    }
    if (!urlMatches(url, request.url)) {
        return false;
    }
    return match ? match(request) : true;
}

/** No narrower than `stubMatches`, which stays the authority on what matches. */
export function routePatternOf(declared: RegExp | string): RegExp | string {
    if (declared instanceof RegExp) {
        return declared;
    }
    const { base } = splitDeclared(declared);
    if (base.startsWith('/')) {
        return new RegExp(
            String.raw`^https?:\/\/[^/?#]+${placeholderPatternSource(base)}(?:\?[^#]*)?(?:#.*)?$`,
            'u',
        );
    }
    if (hasPlaceholders(base)) {
        return new RegExp(String.raw`^${placeholderPatternSource(base)}(?:\?[^#]*)?(?:#.*)?$`, 'u');
    }
    return base;
}

export type StubRoute = {
    methods: string[];
    url: RegExp | string;
};

type StubEntry = {
    stub: Stub;
    served: number;
};

function stateOf({ stub, served }: StubEntry): string {
    const { times } = stub;
    if (times !== undefined && served >= times) {
        return ` (exhausted after ${times})`;
    }
    return served === 0 ? '' : ` (served ${served} time(s))`;
}

export class StubQueue {
    private readonly entries: StubEntry[];

    constructor(stubs: readonly Stub[]) {
        this.entries = stubs.map((stub) => ({ stub, served: 0 }));
    }

    get size(): number {
        return this.entries.length;
    }

    /** Deduped by pattern: two stubs on one URL share one handler and one queue. */
    get routes(): StubRoute[] {
        const routes = new Map<string, StubRoute>();
        for (const { stub } of this.entries) {
            const url = routePatternOf(stub.request.url);
            const key = String(url);
            const route = routes.get(key) ?? { methods: [], url };
            if (!route.methods.includes(stub.request.method)) {
                route.methods.push(stub.request.method);
            }
            routes.set(key, route);
        }
        return [...routes.values()];
    }

    declaredRoutes(): string[] {
        return this.entries.map(({ stub }) => describeRoute(stub));
    }

    /** `null` when nothing unexhausted matches: the strict-violation signal. */
    take(request: MatchableRequest): null | Stub {
        for (const entry of this.entries) {
            const { times } = entry.stub;
            if (times !== undefined && entry.served >= times) {
                continue;
            }
            if (!stubMatches(entry.stub, request)) {
                continue;
            }
            entry.served += 1;
            return entry.stub;
        }
        return null;
    }

    requiredError(): Error | null {
        const unmet: string[] = [];
        for (const { stub, served } of this.entries) {
            if (!stub.required) {
                continue;
            }
            const { times } = stub;
            if (times === undefined) {
                if (served === 0) {
                    unmet.push(
                        `  - ${describeRoute(stub)} — declared and required but never requested`,
                    );
                }
            } else if (served !== times) {
                unmet.push(
                    `  - ${describeRoute(stub)} — declared required with times: ${times} but was requested ${served} time(s)`,
                );
            }
        }
        if (unmet.length === 0) {
            return null;
        }
        return new Error(
            `Required stub(s) never satisfied during the chain:\n${unmet.join('\n')}\n` +
                `A required stub states the call MUST happen — either the code no longer makes it, ` +
                `or the stub no longer describes it.`,
        );
    }

    unmatchedError(method: string, url: string): Error {
        const declared =
            this.entries.length === 0
                ? '  (no stubs declared)'
                : this.entries
                      .map((entry) => `  - ${describeRoute(entry.stub)}${stateOf(entry)}`)
                      .join('\n');
        return new Error(
            refusal('network-strict-after-first-stub', {
                fix: `declare a stub for ${method} ${url} — or raise the \`times\` of the one it exhausted`,
                found: `an unmatched outgoing request, ${method} ${url}; declared:\n${declared}`,
            }),
        );
    }
}
