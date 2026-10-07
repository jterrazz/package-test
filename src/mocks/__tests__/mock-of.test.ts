import { describe, expect, test, vi } from 'vitest';

import { mockOf } from '../mock-of.js';

type Gateway = {
    charge: (amount: number) => Promise<string>;
    refunds: {
        issue: (id: string) => Promise<void>;
    };
};

type Assert<Row extends true> = Row;

// @ts-expect-error -- `mock-of-needs-a-port`: a primitive is not a port, `T extends object`
export type PrimitiveIsRefused = ReturnType<typeof mockOf<string>>;

export type DeepIsTheDefault = Assert<
    ReturnType<typeof mockOf<Gateway>>['refunds']['issue'] extends (id: string) => Promise<void>
        ? true
        : false
>;

describe('mockOf', () => {
    test('mockOf — the typed port double — answers for a nested member without being told to, by default', () => {
        // Given - a double of a port whose members nest
        const gateway = mockOf<Gateway>();

        // Then - the nested call is a mock the test never had to build
        expect(vi.isMockFunction(gateway.refunds.issue)).toBe(true);
    });

    test('mockOf — the typed port double — stops at the first level when the port is mocked flat', () => {
        // Given - the same port, asked for without depth
        const gateway = mockOf<Gateway>({ deep: false });

        // Then - the top-level member is a mock and nothing stands under it
        expect(vi.isMockFunction(gateway.charge)).toBe(true);
        expect(vi.isMockFunction(gateway.refunds.issue)).toBe(false);
    });

    test('mockOf — the typed port double — takes the stubbed answer of a flat double', async () => {
        // Given - a flat double whose one member is told what to reply
        const gateway = mockOf<Gateway>({ deep: false });
        gateway.charge.mockResolvedValue('charged');

        // Then - the double answers it
        await expect(gateway.charge(10)).resolves.toBe('charged');
    });
});
