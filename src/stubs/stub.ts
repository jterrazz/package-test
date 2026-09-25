import type { StubRequest, StubResponseValue } from './exchange.js';

/**
 * A declared external interaction: what to match (`request`) and what to reply
 * (`response`), together in one named artifact. Stubs live in TypeScript
 * files under `stubs/` next to the tests that use them, so the business
 * payload (prompts, JSON responses) is visible at a glance while the real HTTP
 * call stays mocked underneath.
 */
export type Stub = {
    /** Which outgoing call this stub speaks for. */
    request: StubRequest;
    /**
     * The reply — a fixed {@link StubResponse}, or a function
     * `(request) => StubResponse` evaluated per served request when the
     * response must derive from the incoming payload.
     */
    response: StubResponseValue;
    /**
     * How many times this stub may serve. Omitted = unlimited (a
     * re-render or a retry replays it). `n` = exhausted after n serves, so an
     * ordered sequence is a finite stub followed by an unlimited tail.
     */
    times?: number;
    /**
     * When true, the chain FAILS unless the stub was actually requested:
     * at least once, or exactly `times` times when `times` is set. Turns a
     * silently-unused declaration into a spec failure.
     */
    required?: boolean;
};

/**
 * A composite of stubs — the unit tests import. Flat, ordered, immutable;
 * `.with()` derives a variant without touching the original.
 */
export type Stubs = {
    /** The flattened stubs, in selection order. */
    readonly stubs: readonly Stub[];
    /**
     * Derive a new composite: every base stub sharing a route with an
     * override is REPLACED, and the overrides are PREPENDED — so a
     * more-specific override wins first-match selection over a generic base
     * route it does not replace.
     */
    with: (...overrides: (Stub | Stub[] | Stubs)[]) => Stubs;
};

/** Any accepted stub input: one, a list, or a composite. */
export type StubInput = Stub | Stub[] | Stubs;

/**
 * Declare one stub. Identity function — its value is the enforced shape
 * and the naming convention:
 *
 * @example
 *   // specs/api/reports/stubs/openai/classify-article.ts
 *   import { defineStub, openai } from '@jterrazz/test';
 *
 *   export default defineStub({
 *       request: openai.responses({ user: PROMPT, tools: ['classify'] }),
 *       response: openai.reply({ categories: ['TECH'] }),
 *   });
 *
 *   // Dynamic — the response is computed from the observed request:
 *   export default defineStub({
 *       request: http.post('https://api.example.com/echo'),
 *       response: (request) => http.json({ received: request.body }),
 *   });
 */
export function defineStub(stub: Stub): Stub {
    return stub;
}

/** Is this a {@link Stubs} composite (rather than a stub or a list)? */
export function isStubs(value: unknown): value is Stubs {
    return (
        typeof value === 'object' &&
        value !== null &&
        Array.isArray((value as Stubs).stubs) &&
        typeof (value as Stubs).with === 'function'
    );
}

/** Is this a single {@link Stub} (rather than a bare request half)? */
export function isStub(value: unknown): value is Stub {
    return typeof value === 'object' && value !== null && 'request' in value && 'response' in value;
}

/**
 * The route a stub claims — method + the DECLARED url source. Two
 * stubs share a route when they would be written on the same line of a
 * declaration: same method, same url pattern (`.source` for a RegExp).
 */
export function routeKeyOf(stub: Stub): string {
    const { method, url } = stub.request;
    return url instanceof RegExp ? `${method} re:${url.source}` : `${method} str:${url}`;
}

/** Human-readable route of a stub — used in every failure message. */
export function describeRoute(stub: Stub): string {
    const { method, url } = stub.request;
    return `${method === '*' ? 'ANY' : method} ${url instanceof RegExp ? String(url) : url}`;
}

/** Flatten stubs, lists, and composites into one ordered list. */
function flatten(items: readonly StubInput[]): Stub[] {
    const flat: Stub[] = [];
    for (const item of items) {
        if (Array.isArray(item)) {
            flat.push(...flatten(item));
        } else if (isStubs(item)) {
            flat.push(...item.stubs);
        } else {
            flat.push(item);
        }
    }
    return flat;
}

/**
 * Compose stubs into the artifact a test imports — it's stubs all the
 * way down: a composite may extend stubs, lists, and other composites,
 * recursively, order preserved.
 *
 * `.with(...)` derives a scenario: stubs whose route the overrides claim
 * are removed from the base, and the overrides are prepended. Under
 * first-match selection a more specific override (`/articles/gone-1`) also
 * wins over a generic base route (`/articles/{{uuid}}`) it does not replace.
 *
 * @example
 *   // stubs/newsroom.stubs.ts
 *   export default defineStubs(events, articleById);
 *   export const withArticleGone = (id: string) =>
 *       newsroom.with(articleGone(id));
 */
export function defineStubs(...items: StubInput[]): Stubs {
    const stubs = Object.freeze(flatten(items));
    return {
        stubs,
        with(...overrides: StubInput[]): Stubs {
            const added = flatten(overrides);
            const claimed = new Set(added.map(routeKeyOf));
            const kept = stubs.filter((stub) => !claimed.has(routeKeyOf(stub)));
            return defineStubs([...added, ...kept]);
        },
    };
}

/** Normalize any accepted input into a flat stub list. */
export function stubsOf(input: StubInput): Stub[] {
    return flatten([input]);
}
