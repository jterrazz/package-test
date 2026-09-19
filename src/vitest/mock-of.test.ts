import { describe, expect, test, vi } from 'vitest';

import { mockOf } from './mock-of.js';

/** A port with a nested namespace — the shape the two depths disagree on. */
type Gateway = {
    charge: (amount: number) => Promise<string>;
    refunds: {
        issue: (id: string) => Promise<void>;
    };
};

/** Resolves only for `true` — the shape a type row is stated in. */
type Assert<Row extends true> = Row;

// M2 — a double is asked for a PORT: `T` is constrained to `object`, so a
// primitive is refused where the double is asked for, not where it is used.
// @ts-expect-error -- a primitive is not a port: `T extends object`
export type PrimitiveIsRefused = ReturnType<typeof mockOf<string>>;

// The default is deep, and `{ deep: false }` is the flat proxy — two different
// return types from one name, held by the compiler.
export type DeepIsTheDefault = Assert<
    ReturnType<typeof mockOf<Gateway>>['refunds']['issue'] extends (id: string) => Promise<void>
        ? true
        : false
>;

describe('mockOf — the typed port double', () => {
    test('answers for a nested member without being told to, by default', () => {
        // Given - a double of a port whose members nest
        const gateway = mockOf<Gateway>();

        // Then - the nested call is a mock the test never had to build
        expect(vi.isMockFunction(gateway.refunds.issue)).toBe(true);
    });

    test('stops at the first level when the port is mocked flat', () => {
        // Given - the same port, asked for without depth
        const gateway = mockOf<Gateway>({ deep: false });

        // Then - the top-level member is a mock and nothing stands under it
        expect(vi.isMockFunction(gateway.charge)).toBe(true);
        expect(vi.isMockFunction(gateway.refunds.issue)).toBe(false);
    });

    test('takes the stubbed answer of a flat double', async () => {
        // Given - a flat double whose one member is told what to reply
        const gateway = mockOf<Gateway>({ deep: false });
        gateway.charge.mockResolvedValue('charged');

        // Then - the double answers it
        await expect(gateway.charge(10)).resolves.toBe('charged');
    });
});
