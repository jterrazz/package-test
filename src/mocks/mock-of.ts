import { mock, mockDeep } from 'vitest-mock-extended';
import type { DeepMockProxy, MockProxy } from 'vitest-mock-extended';

/** How much of the port the double answers for. */
export type MockOfOptions = {
    /** Deep by default: an unstubbed member hands back another double. `false` gives the flat proxy. */
    deep?: boolean;
};

/** A typed double for an injected port, the doubles ladder's fourth rung (docs/23). */
export function mockOf<T extends object>(options: { deep: false }): MockProxy<T>;
export function mockOf<T extends object>(options?: MockOfOptions): DeepMockProxy<T>;
export function mockOf<T extends object>(options?: MockOfOptions): DeepMockProxy<T> | MockProxy<T> {
    return options?.deep === false ? mock<T>() : mockDeep<T>();
}

/** The factory's own shape — kept as a name so a consumer can annotate with it. */
export type MockPort = typeof mockOf;
