import { describe, expect, test } from 'vitest';

import { RUNNER, specsTree, TWO_ROUTES } from '../../../__tests__/subject.fixtures.js';
import { checkOneSubjectPerSpec } from '../one-subject-per-spec.js';

const IMPORT = "import { api } from '../api.specification.js';";

const JOURNEY =
    "test('orders then lists', async () => { await api.post('/orders', {}); await api.get('/orders'); });";

describe('checkOneSubjectPerSpec', () => {
    test('a spec reaching two subjects is found at the second, with the split and the journey it holds', () => {
        // Given - two routes in two tests, a journey beside a test of its own, a journey alone, a silenced spec and a spec of one subject
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/alone.spec.ts': [IMPORT, JOURNEY, ''].join('\n'),
            'api/orders/journey.spec.ts': [
                IMPORT,
                JOURNEY,
                "test('lists', async () => { await api.get('/orders'); });",
                '',
            ].join('\n'),
            'api/orders/one.spec.ts': `${IMPORT}\ntest('a', async () => { await api.get('/orders'); });\n`,
            'api/orders/orders.spec.ts': TWO_ROUTES,
            'api/orders/silenced.spec.ts': TWO_ROUTES.replace(
                '        // Given - an empty table',
                '        // checker-disable-next-line one-subject-per-spec -- one journey',
            ),
        });

        // Then - each spec of two subjects, the split it takes, and the seed a journey owes
        expect(
            checkOneSubjectPerSpec(root).map(
                ({ column, fix, found, line, path, rule }) =>
                    `${rule} ${path}:${line}:${column} ${found} — ${fix}`,
            ),
        ).toStrictEqual([
            'one-subject-per-spec api/orders/alone.spec.ts:2:78 a spec reaching 2 subjects — POST /orders, GET /orders — the test "orders then lists" reaches POST /orders and GET /orders — state what it stands on with a seed, and keep one subject per test',
            'one-subject-per-spec api/orders/journey.spec.ts:2:78 a spec reaching 2 subjects — POST /orders, GET /orders — split it, one file per subject — api/orders/create/journey.spec.ts, api/orders/list/journey.spec.ts — `typescript fix` splits it; the test "orders then lists" reaches POST /orders and GET /orders — state what it stands on with a seed, and keep one subject per test',
            'one-subject-per-spec api/orders/orders.spec.ts:25:30 a spec reaching 2 subjects — GET /orders, POST /orders — split it, one file per subject — api/orders/list/orders.spec.ts, api/orders/create/orders.spec.ts — `typescript fix` splits it',
        ]);
    });
});
