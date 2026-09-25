import type { StubRequest, StubResponseValue } from './exchange/exchange.js';

/** A declared external interaction: what to match and what to reply. */
export type Stub = {
    /** Which outgoing call this stub speaks for. */
    request: StubRequest;
    /** A fixed reply, or a function of the observed request. */
    response: StubResponseValue;
    /** How many times it may serve; omitted is unlimited. */
    times?: number;
    /** Fail the chain unless it was requested (exactly `times` times when set). */
    required?: boolean;
};

/** A composite of stubs; `.with()` derives a variant without touching the original. */
export type Stubs = {
    /** The flattened stubs, in selection order. */
    readonly stubs: readonly Stub[];
    /** Overrides replace base stubs of the same route and are prepended, so a more specific override wins first match. */
    with: (...overrides: (Stub | Stub[] | Stubs)[]) => Stubs;
};

/** Any accepted stub input: one, a list, or a composite. */
export type StubInput = Stub | Stub[] | Stubs;

export function defineStub(stub: Stub): Stub {
    return stub;
}

export function isStubs(value: unknown): value is Stubs {
    return (
        typeof value === 'object' &&
        value !== null &&
        Array.isArray((value as Stubs).stubs) &&
        typeof (value as Stubs).with === 'function'
    );
}

export function isStub(value: unknown): value is Stub {
    return typeof value === 'object' && value !== null && 'request' in value && 'response' in value;
}

/** Same method and same declared url source (`.source` for a RegExp). */
export function routeKeyOf(stub: Stub): string {
    const { method, url } = stub.request;
    return url instanceof RegExp ? `${method} re:${url.source}` : `${method} str:${url}`;
}

export function describeRoute(stub: Stub): string {
    const { method, url } = stub.request;
    return `${method === '*' ? 'ANY' : method} ${url instanceof RegExp ? String(url) : url}`;
}

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

/** Compose stubs, lists and composites, order preserved; `.with()` derives a scenario. */
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

export function stubsOf(input: StubInput): Stub[] {
    return flatten([input]);
}
