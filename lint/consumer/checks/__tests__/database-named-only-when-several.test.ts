import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import { checkDatabaseNamedOnlyWhenSeveral } from '../database-named-only-when-several.js';

const MULTI =
    'export const { api } = await specification.api({ services: { a: postgres(), b: sqlite() } });\n';
const SINGLE =
    'export const { api: one } = await specification.api({ services: { db: postgres() } });\n';
const NONE =
    'export const { api: free } = await specification.api({ services: { cache: redis() } });\n';

describe('checkDatabaseNamedOnlyWhenSeveral', () => {
    test('a seed or table call names its database when several are declared, and only then', () => {
        // Given - specs reading runners of two databases, of one, of none, of two kinds at once, a local runner, a chained seed and a silenced line
        const root = packageWith({
            'specs/api/multi.specification.ts': MULTI,
            'specs/api/none.specification.ts': NONE,
            'specs/api/single.specification.ts': SINGLE,
            'specs/api/a.spec.ts': [
                "import { api } from './multi.specification.js';",
                "await api.seed('x');",
                "await api.table('t', { database: 'a' });",
                "await api.seed('x'); // checker-disable-line database-named-only-when-several -- the case",
                'const { api: local } = await specification.api({});',
                "await local.seed('x');",
                '',
            ].join('\n'),
            'specs/api/b.spec.ts': [
                "import { one } from './single.specification.js';",
                "await one.table('t', { database: 'db' });",
                "await one.seed('x');",
                '',
            ].join('\n'),
            'specs/api/c.spec.ts': [
                "import { api } from './multi.specification.js';",
                "import { one } from './single.specification.js';",
                "await api.seed('x');",
                '',
            ].join('\n'),
            'specs/api/e.spec.ts': [
                "import { api } from './multi.specification.js';",
                "import { free } from './none.specification.js';",
                "await api.with({}).seed('x');",
                '',
            ].join('\n'),
            'specs/api/d.spec.ts': [
                "import { free } from './none.specification.js';",
                "await free.seed('x', { database: 'db' });",
                '',
            ].join('\n'),
        });

        // Then - the unnamed seed of two databases and the named table of one
        expect(
            checkDatabaseNamedOnlyWhenSeveral(root).map(
                ({ fix, found, line, path, rule }) => `${rule} ${path}:${line} ${found} — ${fix}`,
            ),
        ).toStrictEqual([
            "database-named-only-when-several specs/api/a.spec.ts:2 `.seed()` with no `{ database }`, while 2 SQL databases are declared — pass `.seed(…, { database: '<key>' })`, naming one of the 2 databases the services record declares",
            'database-named-only-when-several specs/api/b.spec.ts:2 `.table()` passes `{ database }`, while a single SQL database is declared — delete the `{ database }` option of `.table()`',
            "database-named-only-when-several specs/api/e.spec.ts:3 `.seed()` with no `{ database }`, while 2 SQL databases are declared — pass `.seed(…, { database: '<key>' })`, naming one of the 2 databases the services record declares",
        ]);
    });
});
