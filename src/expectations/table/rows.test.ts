import { describe, expect, test } from 'vitest';

import { CaptureScope } from '../tokens/capture-scope.js';
import { match } from '../tokens/match.js';
import { pairRows } from './rows.js';
import type { RowPairing } from './rows.js';

const ordered = (expected: unknown[][], actual: unknown[][]): RowPairing =>
    pairRows(expected, actual, new CaptureScope(), true);

const multiset = (expected: unknown[][], actual: unknown[][]): RowPairing =>
    pairRows(expected, actual, new CaptureScope(), false);

describe('pairRows', () => {
    test('pairRows — a table as a multiset of rows — rows in another order pair with the rows they match', () => {
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

    test('pairRows — a table as a multiset of rows — a capture shared across rows settles the pairing each row alone could not', () => {
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

    test('pairRows — a table as a multiset of rows — a row that matches none is shown against the row it resembles most, and a row too many alone', () => {
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

    test('pairRows — ordered — the rows pair by position, a row past either end standing alone', () => {
        // Given - rows compared as an order: two swapped, then a match and a stated row too many, then a row too many in the table

        // Then - each pairing by position
        expect([
            ordered(
                [
                    [2, 'Bob'],
                    [1, 'Ada'],
                ],
                [
                    [1, 'Ada'],
                    [2, 'Bob'],
                ],
            ),
            ordered(
                [
                    [1, 'Ada'],
                    [2, 'Bob'],
                ],
                [[1, 'Ada']],
            ),
            ordered(
                [[1, 'Ada']],
                [
                    [1, 'Ada'],
                    [2, 'Bob'],
                ],
            ),
            ordered([[1, 'Ada']], [[1, 'Ada']]),
        ]).toStrictEqual([
            {
                pairs: [
                    { actual: [1, 'Ada'], expected: [2, 'Bob'], matched: false },
                    { actual: [2, 'Bob'], expected: [1, 'Ada'], matched: false },
                ],
                pass: false,
            },
            {
                pairs: [
                    { actual: [1, 'Ada'], expected: [1, 'Ada'], matched: true },
                    { actual: undefined, expected: [2, 'Bob'], matched: false },
                ],
                pass: false,
            },
            {
                pairs: [
                    { actual: [1, 'Ada'], expected: [1, 'Ada'], matched: true },
                    { actual: [2, 'Bob'], expected: undefined, matched: false },
                ],
                pass: false,
            },
            { pairs: [{ actual: [1, 'Ada'], expected: [1, 'Ada'], matched: true }], pass: true },
        ]);
    });

    test('pairRows — a table as a multiset of rows — a row is matched whole, each actual row once, the most resembling free row shown, the first on a tie', () => {
        // Given - a row with a cell too many, a stated row twice over one actual row, and two stated rows resembling the same free rows

        // Then - each pairing
        expect([
            multiset([[1]], [[1, 2]]).pass,
            multiset(
                [
                    [1, 'Ada'],
                    [1, 'Ada'],
                ],
                [
                    [1, 'Ada'],
                    [9, 'Zed'],
                ],
            ).pairs,
            multiset(
                [
                    [2, 'Eve', 'y'],
                    [2, 'Fay', 'y'],
                ],
                [
                    [3, 'Cy', 'y'],
                    [2, 'Bob', 'y'],
                    [2, 'Dan', 'y'],
                ],
            ).pairs,
        ]).toStrictEqual([
            false,
            [
                { actual: [1, 'Ada'], expected: [1, 'Ada'], matched: true },
                { actual: undefined, expected: [1, 'Ada'], matched: false },
                { actual: [9, 'Zed'], matched: false },
            ],
            [
                { actual: [2, 'Bob', 'y'], expected: [2, 'Eve', 'y'], matched: false },
                { actual: [2, 'Dan', 'y'], expected: [2, 'Fay', 'y'], matched: false },
                { actual: [3, 'Cy', 'y'], matched: false },
            ],
        ]);
    });

    test('pairRows — a table as a multiset of rows — rows that each fit any row take one each, and rows that fit alone but not with their shared capture match none', () => {
        // Given - two rows of any value, and two rows binding one capture to two values
        const any = pairRows(
            [[match.any()], [match.any()]],
            [['a'], ['b']],
            new CaptureScope(),
            false,
        );
        const scope = new CaptureScope();
        const conflicting = pairRows(
            [
                [match.ref('x'), 'a'],
                [match.ref('x'), 'b'],
            ],
            [
                [1, 'a'],
                [2, 'b'],
            ],
            scope,
            false,
        );

        // Then - one row each, and a conflict that matches nothing and binds nothing
        expect([any.pairs.map((pair) => pair.actual), conflicting, scope.get('x')]).toStrictEqual([
            [['a'], ['b']],
            {
                pairs: [
                    { actual: [1, 'a'], expected: [match.ref('x'), 'a'], matched: false },
                    { actual: [2, 'b'], expected: [match.ref('x'), 'b'], matched: false },
                ],
                pass: false,
            },
            undefined,
        ]);
    });
});
