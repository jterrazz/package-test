import type { StubRequest, StubResponseValue } from './exchange.js';
import { routeKeyOf } from './matching/route.js';

/** A declared external interaction: what to match and what to reply. */
export type Stub = {
    /** Which outgoing call this stub speaks for. */
    request: StubRequest;
    /** A fixed reply, or a function of the observed request. */
    response: StubResponseValue;
    /** How many times it may serve; omitted is unlimited. `0` with `required` is a never stub: docs/reference/stubs.md#never--a-call-that-must-not-happen. */
    times?: number;
    /** Fail the chain unless it was requested: exactly `times` times when set, so `times: 0` fails it once requested. */
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

function flatten(items: readonly StubInput[]): Stub[] {
    const flat: Stub[] = [];
    for (const item of items) {
        if (Array.isArray(item)) {
            flat.push(...flatten(item));
        } else if ('stubs' in item) {
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
            const claimed = new Set(added.map((stub) => routeKeyOf(stub.request)));
            const kept = stubs.filter((stub) => !claimed.has(routeKeyOf(stub.request)));
            return defineStubs([...added, ...kept]);
        },
    };
}

export function stubsOf(input: StubInput): Stub[] {
    return flatten([input]);
}
