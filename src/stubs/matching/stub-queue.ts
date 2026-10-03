import { refusal } from '../../chain/refusals/refusal.js';
import type { MatchableRequest } from '../exchange.js';
import type { Stub } from '../stub.js';
import { describeRoute, routePatternOf, urlMatches } from './route.js';

function stubMatches(stub: Stub, request: MatchableRequest): boolean {
    const { absentHeaders, match, method, url } = stub.request;
    if (method !== '*' && method.toUpperCase() !== request.method.toUpperCase()) {
        return false;
    }
    if (!urlMatches(url, request.url)) {
        return false;
    }
    if (absentHeaders?.some((name) => request.headers[name.toLowerCase()] !== undefined) === true) {
        return false;
    }
    return match ? match(request) : true;
}

type StubRoute = {
    methods: string[];
    url: RegExp | string;
};

type StubEntry = {
    reached: string[];
    stub: Stub;
    served: number;
};

function isNever({ required, times }: Stub): boolean {
    return required === true && times === 0;
}

function stateOf({ stub, served }: StubEntry): string {
    const { times } = stub;
    if (isNever(stub)) {
        return served === 0 ? ' (never)' : ` (never, reached ${served} time(s))`;
    }
    if (times !== undefined && served >= times) {
        return ` (exhausted after ${times})`;
    }
    return served === 0 ? '' : ` (served ${served} time(s))`;
}

/** The first unexhausted stub in declaration order answers; `times: n` is spent after n serves. */
export class StubQueue {
    private readonly entries: StubEntry[];

    constructor(stubs: readonly Stub[]) {
        this.entries = stubs.map((stub) => ({ reached: [], stub, served: 0 }));
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
            const never = isNever(entry.stub);
            if (!never && times !== undefined && entry.served >= times) {
                continue;
            }
            if (!stubMatches(entry.stub, request)) {
                continue;
            }
            entry.served += 1;
            if (never) {
                entry.reached.push(`${request.method} ${request.url}`);
            }
            return entry.stub;
        }
        return null;
    }

    verdict(unmatched: Error | null = null): Error | null {
        const errors = [this.neverError(), unmatched, this.unmetError()].filter(
            (error): error is Error => error !== null,
        );
        if (errors.length <= 1) {
            return errors[0] ?? null;
        }
        const reports = errors.map(({ message }) => message).join('\n\n');
        return new AggregateError(
            errors,
            refusal({
                fix: 'correct each outcome in turn, by its own fix',
                found: `${errors.length} outcomes of one action, each with its own refusal:\n\n${reports}`,
                read: 'docs/17-stubs.md#strict-by-construction',
                why: 'A reached never stub, an unmatched request and an unmet required stub are independent facts about one action, so all are reported at once.',
            }),
        );
    }

    private neverError(): Error | null {
        const reached = this.entries.filter(({ stub, served }) => isNever(stub) && served > 0);
        if (reached.length === 0) {
            return null;
        }
        const lines = reached.map(
            ({ reached: calls, stub }) =>
                `  - ${describeRoute(stub.request)} — reached by ${calls.join(', ')}`,
        );
        return new Error(
            refusal({
                fix: 'take the call out of the path under test — or, if the call is now intended, replace the never stub with one that answers it',
                found: `a route the chain declared never requested was reached:\n${lines.join('\n')}`,
                read: 'docs/17-stubs.md#never--a-call-that-must-not-happen',
                why: "A never stub states the subject must not reach its route within the chain's terminal action, or the `intercept()` scope, it is declared for.",
            }),
        );
    }

    private unmetError(): Error | null {
        const unmet: string[] = [];
        for (const { stub, served } of this.entries) {
            if (stub.required !== true || isNever(stub)) {
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
                read: 'docs/17-stubs.md#required-is-verified-per-terminal-action',
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
