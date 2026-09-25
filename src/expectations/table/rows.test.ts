import { describe, expect, test } from 'vitest';

import { CaptureScope, match } from '../tokens/match.js';
import { pairRows } from './rows.js';

describe('pairRows — a table as a multiset of rows', () => {
    test('rows in another order pair with the rows they match', () => {
        // Given - two rows stated in the other order
        const pairing = pairRows(
            [
                [2, 'Bob'],
                [1, 'Ada'],
            ],
            [
                [1, 'Ada'],
                [2, 'Bob'],
            ],
            new CaptureScope(),
            false,
        );

        // Then - both match, in the order stated
        expect(pairing).toStrictEqual({
            pairs: [
                { actual: [2, 'Bob'], expected: [2, 'Bob'], matched: true },
                { actual: [1, 'Ada'], expected: [1, 'Ada'], matched: true },
            ],
            pass: true,
        });
    });

    test('a capture shared across rows settles the pairing each row alone could not', () => {
        // Given - two rows each matching either row alone, the second requiring the first's id
        const scope = new CaptureScope();
        const pairing = pairRows(
            [
                [match.ref('first'), match.any()],
                [match.any(), match.ref('first')],
            ],
            [
                ['a', 'b'],
                ['b', 'x'],
            ],
            scope,
            false,
        );

        // Then - the first stated row took the row whose id the second names, and the capture holds it
        expect(pairing.pass).toBe(true);
        expect(pairing.pairs.map((pair) => pair.actual)).toStrictEqual([
            ['b', 'x'],
            ['a', 'b'],
        ]);
        expect(scope.get('first')).toBe('b');
    });

    test('a row that matches none is shown against the row it resembles most, and a row too many alone', () => {
        // Given - one stated row off by a name, and a table holding a third row
        const pairing = pairRows(
            [
                [1, 'Ada'],
                [2, 'Eve'],
            ],
            [
                [2, 'Bob'],
                [1, 'Ada'],
                [3, 'Cy'],
            ],
            new CaptureScope(),
            false,
        );

        // Then - Ada matches, Eve stands against Bob, and Cy is extra
        expect(pairing).toStrictEqual({
            pairs: [
                { actual: [1, 'Ada'], expected: [1, 'Ada'], matched: true },
                { actual: [2, 'Bob'], expected: [2, 'Eve'], matched: false },
                { actual: [3, 'Cy'], matched: false },
            ],
            pass: false,
        });
    });

    test('ordered, the rows pair by position', () => {
        // Given - the same rows in another order, compared as an order
        const pairing = pairRows(
            [
                [2, 'Bob'],
                [1, 'Ada'],
            ],
            [
                [1, 'Ada'],
                [2, 'Bob'],
            ],
            new CaptureScope(),
            true,
        );

        // Then - neither position matches
        expect(pairing.pass).toBe(false);
        expect(pairing.pairs.map((pair) => pair.matched)).toStrictEqual([false, false]);
    });
});
