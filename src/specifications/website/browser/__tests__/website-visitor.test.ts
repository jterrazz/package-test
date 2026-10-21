import { describe, expect, test } from 'vitest';

import { valued } from '../../../../visitor/targets/modifiers.js';
import { field } from '../../../../visitor/targets/roles.js';
import type { Target } from '../../../../visitor/targets/target.js';
import { waitForValue } from '../website-visitor.js';

type Locator = Parameters<typeof waitForValue>[0];

function fieldHolding(value: null | string): Locator {
    const locator = {
        inputValue: async (): Promise<string> => {
            if (value === null) {
                throw new Error('locator.inputValue: Timeout exceeded');
            }
            return await Promise.resolve(value);
        },
    };
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the poll reads a field's value and nothing else of a locator
    return locator as unknown as Locator;
}

async function waited(value: null | string, target: Target, wanted: boolean): Promise<string> {
    const waiting = waitForValue(fieldHolding(value), target, wanted, 30);
    return await waiting.then(
        () => 'held',
        (error: unknown) => (error instanceof Error ? (error.message.split('\n')[0] ?? '') : ''),
    );
}

describe('website-visitor', () => {
    test('waitForValue — a field read by its live value — answers once the value holds, and refuses within its budget when it never does', async () => {
        // Given - a field holding "a", and one not on the page
        const email = valued(field('Email'), 'a');
        const other = valued(field('Email'), 'b');

        // When - each verb waits on each, within 30 ms
        const outcomes = await Promise.all([
            waited('a', email, true),
            waited('a', other, false),
            waited(null, email, false),
            waited('a', other, true),
            waited('a', email, false),
            waited(null, email, true),
        ]);

        // Then - the three that hold answer, the three that never do name what the field holds
        expect(outcomes).toStrictEqual([
            'held',
            'held',
            'held',
            'found: field("Email") never held "b", it holds "a"',
            'found: field("Email") still holds "a", it holds "a"',
            'found: field("Email") never held "a" (it is not on the page)',
        ]);
    });
});
