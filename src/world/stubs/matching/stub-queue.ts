import { refusal } from '../../../../lint/index.refusal.js';
import type { MatchableRequest } from '../exchange.js';
import type { Stub } from '../stub.js';
import { describeRoute, routePatternOf, urlMatches } from './route.js';

function stubMatches(stub: Stub, request: MatchableRequest): boolean {
    const { match, method, url } = stub.request;
    if (method !== '*' && method.toUpperCase() !== request.method.toUpperCase()) {
        return false;
    }
    if (!urlMatches(url, request.url)) {
        return false;
    }
    return match ? match(request) : true;
}

type StubRoute = {
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

/** The first unexhausted stub in declaration order answers; `times: n` is spent after n serves. */
export class StubQueue {
    private readonly entries: StubEntry[];

    constructor(stubs: readonly Stub[]) {
        this.entries = stubs.map((stub) => ({ stub, served: 0 }));
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
        return this.entries.map(({ stub }) => describeRoute(stub.request));
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
                        `  - ${describeRoute(stub.request)} — declared and required but never requested`,
                    );
                }
            } else if (served !== times) {
                unmet.push(
                    `  - ${describeRoute(stub.request)} — declared required with times: ${times} but was requested ${served} time(s)`,
                );
            }
        }
        if (unmet.length === 0) {
            return null;
        }
        return new Error(
            refusal({
                fix: 'the code no longer makes the call, or the stub no longer describes it: correct the one that drifted',
                found: `required stub(s) never satisfied during the chain:\n${unmet.join('\n')}`,
                read: 'docs/16-stubs.md#required-is-verified-per-terminal-action',
                why: 'A required stub states the call MUST happen, within the terminal action it is declared for.',
            }),
        );
    }

    unmatchedError(method: string, url: string): Error {
        const declared =
            this.entries.length === 0
                ? '  (no stubs declared)'
                : this.entries
                      .map((entry) => `  - ${describeRoute(entry.stub.request)}${stateOf(entry)}`)
                      .join('\n');
        return new Error(
            refusal('network-strict-after-first-stub', {
                fix: `declare a stub for ${method} ${url} — or raise the \`times\` of the one it exhausted`,
                found: `an unmatched outgoing request, ${method} ${url}; declared:\n${declared}`,
            }),
        );
    }
}
