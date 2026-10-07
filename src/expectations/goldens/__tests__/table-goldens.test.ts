import { describe, expect, test, vi } from 'vitest';

import type { DatabasePort } from '../../../services/database.port.js';
import { TableAccessor } from '../../table/table.js';
import { registerMatchers } from '../matchers.js';
import { matchTableValue, tableExpectation } from '../table-goldens.js';
import { scratchTest, wholeOf } from './response-goldens.fixtures.js';

/** A fixed sequence of uuids in an order no test predicts from their names. */
function uuidDraw(): () => string {
    let state = 7;
    return () => {
        state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
        return `${state.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;
    };
}

function randomIdRuns(count: number): { rows: string[][]; run: number }[] {
    const draw = uuidDraw();
    return Array.from({ length: count }, (_, run) => ({
        rows: ['Ada', 'Bob', 'Cy'].map((name) => [draw(), name, '2026-01-02']),
        run,
    }));
}

function usersTable(rows: unknown[][]): DatabasePort {
    return {
        columns: async () => ['id', 'name', 'created_at'],
        query: async () => rows,
        reset: async () => {},
        seed: async () => {},
    };
}

await registerMatchers();

describe('table-goldens', () => {
    test('toMatch compares the whole result to the value written in place, and update mode writes it there (`no-volatile-literal`) — a table against its rows: every column, an instant read as its ISO text', async () => {
        // Given - a table holding one row, its instant a Date as a driver hands it
        const subject = new TableAccessor(
            'users',
            usersTable([[7, 'Ada', new Date('2026-01-02T03:04:05.000Z')]]),
        );

        // Then - the rows match whole; a row too many is the table diff
        await expect(subject).toMatch([['{{int}}', 'Ada', '2026-01-02T03:04:05.000Z']]);
        await expect(expect(subject).toMatch([])).rejects.toThrow(
            /Table "users" mismatch[\s\S]*query: id, name, created_at[\s\S]*\+ 7 {2}\| {2}Ada/u,
        );
    });

    test.each(randomIdRuns(50))(
        'toMatch compares the whole result to the value written in place, and update mode writes it there (`no-volatile-literal`) — a table of rows keyed by random ids matches whatever order they come back in, run $run',
        async ({ rows }) => {
            // Given - three rows keyed by uuids drawn anew for this run, handed back in their first column's order
            const sorted = rows.toSorted((a, b) => String(a[0]).localeCompare(String(b[0])));
            const subject = new TableAccessor('users', usersTable(sorted));

            // Then - it matches the rows as the test states them, each id captured on its own row
            await expect(subject).toMatch([
                ['{{uuid#ada}}', 'Ada', '2026-01-02'],
                ['{{uuid#bob}}', 'Bob', '2026-01-02'],
                ['{{uuid#cy}}', 'Cy', '2026-01-02'],
            ]);
            expect(subject.captures.get('bob')).toBe(rows[1]?.[0]);
        },
    );

    test("toMatch compares the whole result to the value written in place, and update mode writes it there (`no-volatile-literal`) — a table compared { ordered: true } holds its first column's order as part of the claim", async () => {
        // Given - two rows, handed back as the table orders them
        const subject = new TableAccessor(
            'users',
            usersTable([
                [1, 'Ada', '2026-01-02'],
                [2, 'Bob', '2026-01-02'],
            ]),
        );

        // Then - the rows in another order match as a multiset, and fail as an order
        await expect(subject).toMatch([
            [2, 'Bob', '2026-01-02'],
            [1, 'Ada', '2026-01-02'],
        ]);
        await expect(
            expect(subject).toMatch(
                [
                    [2, 'Bob', '2026-01-02'],
                    [1, 'Ada', '2026-01-02'],
                ],
                { frozen: true, ordered: true },
            ),
        ).rejects.toThrow(/- 2 {2}\| {2}Bob[\s\S]*\+ 1 {2}\| {2}Ada/u);
    });

    test('toMatch compares the whole result to the value written in place, and update mode writes it there (`no-volatile-literal`) — a table diff pairs each stated row with the row it resembles most, and shows the rows that match as matching', async () => {
        // Given - two rows, one stated with a wrong name, stated in the other order
        const subject = new TableAccessor(
            'users',
            usersTable([
                [1, 'Ada', '2026-01-02'],
                [2, 'Bob', '2026-01-02'],
            ]),
        );

        // Then - Bob's row matches, and Ada's is shown against the row it was meant to be
        await expect(
            expect(subject).toMatch(
                [
                    [2, 'Bob', '2026-01-02'],
                    [1, 'Eve', '2026-01-02'],
                ],
                { frozen: true },
            ),
        ).rejects.toThrow(
            /\n {2}2 {2}\| {2}Bob {2}\| {2}2026-01-02\n\S*- 1 {2}\| {2}Eve {2}\| {2}2026-01-02\S*\n\S*\+ 1 {2}\| {2}Ada/u,
        );
    });

    test('toMatch compares the whole result to the value written in place, and update mode writes it there (`no-volatile-literal`) — a table the database does not hold is refused naming it', async () => {
        // Given - a table with no columns
        const subject = new TableAccessor('ghost', {
            ...usersTable([]),
            columns: async () => [],
        });

        // Then - refused, before a SELECT with no columns reaches the driver
        await expect(expect(subject).toMatch([])).rejects.toThrow(
            [
                'found: table "ghost" has no columns: the database holds no such table',
                'why: A table is read from the database that holds it.',
                'fix: name a table the database holds, or create it in the init script or a seed',
                'read: docs/reference/assertions.md#resulttablename--database---database-tables-api-job-cli-integration',
            ].join('\n'),
        );
    });

    test('toMatch compares the whole result to the value written in place, and update mode writes it there (`no-volatile-literal`) — a table not yet recorded is written row by row, a cell keeping the token that still matches', async () => {
        // Given - a table, an empty value, then rows whose instant was a token
        vi.stubEnv('TEST_UPDATE', '1');
        const table = new TableAccessor(
            'users',
            usersTable([[1, 'Ada', new Date('2026-01-02T03:04:05.000Z')]]),
        );
        const empty = scratchTest("await expect(result.table('users')).toMatch('');");
        const tokened = scratchTest(
            "await expect(result.table('users')).toMatch([[1, 'Bob', '{{iso8601}}']]);",
        );

        // When - both are compared
        await wholeOf(table)('', undefined, empty.stack);
        await wholeOf(table)([[1, 'Bob', '{{iso8601}}']], undefined, tokened.stack);

        // Then - the rows as code; the instant kept as its token where one stood
        expect(empty.read()).toContain(
            'toMatch([\n        [1, "Ada", "2026-01-02T03:04:05.000Z"],\n    ]);',
        );
        expect(tokened.read()).toContain('toMatch([\n        [1, "Ada", "{{iso8601}}"],\n    ]);');
    });

    test('the rows in place — a value is rows, not yet recorded, or neither; a table matching says so, one not recorded names update mode', async () => {
        // Given - values of each kind, and a table of one row
        const table = new TableAccessor('users', usersTable([[1, 'Ada', '2026-01-02']]));
        const context = { negated: false, options: undefined, stack: '' };
        const verdict = async (expected: '' | unknown[][]): Promise<[boolean, string]> => {
            const result = await matchTableValue(table, expected, context);
            return [result.pass, result.message()];
        };

        // Then - each reading and each verdict
        expect([
            [
                tableExpectation([[1]]),
                tableExpectation(' \n'),
                tableExpectation('x'),
                tableExpectation([1]),
            ],
            await verdict([[1, 'Ada', '{{any}}']]),
            await verdict(''),
        ]).toStrictEqual([
            [[[1]], '', undefined, undefined],
            [true, 'expected table "users" not to match the rows in place'],
            [
                false,
                'Table "users" (the value in place): nothing is written in place yet — run with TEST_UPDATE=1 (or vitest -u) and the actual value is written into the test.',
            ],
        ]);
    });

    test('the rows in place — update mode writes the rows the table holds, a row stated past them dropped', async () => {
        // Given - update mode, rows in place one more than the table holds
        vi.stubEnv('TEST_UPDATE', '1');
        const table = new TableAccessor('users', usersTable([[1, 'Ada', '2026-01-02']]));
        const site = scratchTest(
            "await expect(result.table('users')).toMatch([[1, 'Ada', 'x'], [2, 'Bob', 'y']]);",
        );

        // When - compared
        await wholeOf(table)(
            [
                [1, 'Ada', 'x'],
                [2, 'Bob', 'y'],
            ],
            undefined,
            site.stack,
        );

        // Then - the one row the table holds
        expect(site.read()).toContain('toMatch([\n        [1, "Ada", "2026-01-02"],\n    ]);');
    });
});
