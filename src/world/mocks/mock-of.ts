import { mock, mockDeep } from 'vitest-mock-extended';
import type { DeepMockProxy, MockProxy } from 'vitest-mock-extended';

/** How much of the port the double answers for. */
export type MockOfOptions = {
    /**
     * Deep (the default): reading a member that was never stubbed hands back
     * another double, however far down the port nests. `false` gives the flat
     * proxy — every member of `T` and nothing beneath them, which is what a
     * port with a nested namespace wants when the test only ever touches the
     * first level.
     */
    deep?: boolean;
};

/**
 * A typed double for an injected port — the fourth rung of the doubles ladder
 * (docs/18-conventions.md), and the only one a module test may build itself.
 *
 * The type argument is the port: `T` is constrained to `object` and has no
 * default, so a double is always asked for something. A call with no argument
 * answers for `object`, which satisfies no port and fails where it is used.
 *
 * @example
 *   const gateway = mockOf<PaymentGateway>();                // deep
 *   const clock = mockOf<ClockPort>({ deep: false });        // flat
 */
export function mockOf<T extends object>(options: { deep: false }): MockProxy<T>;
export function mockOf<T extends object>(options?: MockOfOptions): DeepMockProxy<T>;
export function mockOf<T extends object>(options?: MockOfOptions): DeepMockProxy<T> | MockProxy<T> {
    return options?.deep === false ? mock<T>() : mockDeep<T>();
}

/** The factory's own shape — kept as a name so a consumer can annotate with it. */
export type MockPort = typeof mockOf;
