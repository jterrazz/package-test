import { describe, expect, test } from 'vitest';

import { refusingInProcessSetups } from '../refused-setups.js';

type Chain = { headers: () => Chain; label: string; send: () => Promise<string> };

function chainOf(label: string): Chain {
    return {
        headers: () => chainOf(`${label}+headers`),
        label,
        send: async () => await Promise.resolve(`sent ${label}`),
    };
}

function refusalOf(work: () => unknown): string {
    try {
        work();
        return '';
    } catch (error) {
        return error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error);
    }
}

describe('refused-setups', () => {
    test('refusingInProcessSetups — a deployed chain — refuses what reaches into an app built here, at every step of the chain', () => {
        // Given - a chain, and the chain a setup hands back
        const chain = refusingInProcessSetups(chainOf('base'));
        const next = chain.headers();

        // Then - each in-process verb refused by name, on both
        expect(
            ['clock', 'delete', 'intercept', 'post', 'put', 'seed'].map((name) =>
                refusalOf(() => {
                    const refused: unknown = Reflect.get(next, name);
                    if (typeof refused === 'function') {
                        Reflect.apply(refused, undefined, []);
                    }
                }),
            ),
        ).toStrictEqual(
            ['clock', 'delete', 'intercept', 'post', 'put', 'seed'].map(
                (name) => `found: .${name}() on the chain of specification.api({ url })`,
            ),
        );
        expect(
            refusalOf(() => {
                const refused: unknown = Reflect.get(chain, 'seed');
                if (typeof refused === 'function') {
                    Reflect.apply(refused, undefined, []);
                }
            }),
        ).toBe('found: .seed() on the chain of specification.api({ url })');
    });

    test('refusingInProcessSetups — a deployed chain — hands a value, a setup and an action through as they are', async () => {
        // Given - the chain behind the refusals
        const chain = refusingInProcessSetups(chainOf('base'));

        // Then - its value read, its setup chained, its action awaited
        expect([chain.label, chain.headers().label, await chain.headers().send()]).toStrictEqual([
            'base',
            'base+headers',
            'sent base+headers',
        ]);
    });
});
