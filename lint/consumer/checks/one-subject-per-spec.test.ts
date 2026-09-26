import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { RUNNER, specsTree, TWO_ROUTES } from '../../engine/testing/subject.fixtures.js';
import { checkOneSubjectPerSpec } from './one-subject-per-spec.js';
import { checkSpecInSubjectFolder } from './spec-in-subject-folder.js';

describe('checkOneSubjectPerSpec', () => {
    test('one-subject-per-spec — a spec of two routes is reported at the chain reaching the second, naming the split', () => {
        // Given - one file reaching GET /orders and POST /orders
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/orders/orders.spec.ts': TWO_ROUTES,
        });

        // Then - one `one-subject-per-spec` finding, where the second route is sent, and no `spec-in-subject-folder` before the split
        const [finding] = checkOneSubjectPerSpec(root);
        expect({ column: finding?.column, line: finding?.line }).toStrictEqual({
            column: 30,
            line: 25,
        });
        expect(finding?.found).toBe('a spec reaching 2 subjects — GET /orders, POST /orders');
        expect(finding?.fix).toBe(
            'split it, one file per subject — api/orders/list/orders.spec.ts, api/orders/create/orders.spec.ts — `make fix` splits it',
        );
        expect(checkSpecInSubjectFolder(root)).toStrictEqual([]);
    });

    test("one-subject-per-spec — a spec holding two runners reads each chain with its own runner's list", () => {
        // Given - a spec importing a runner with no list first, and running `db migrate` through the one declaring it
        const root = specsTree({
            'cli/cli.specification.ts':
                'export const { cleanup, cli } = await specification.cli(BIN);\n',
            'cli/db-cli.specification.ts':
                "export const { cleanup, cli } = await specification.cli(BIN, { commands: ['db', 'migrate'] });\n",
            'cli/db/runs.spec.ts': [
                "import { cli } from '../cli.specification.js';",
                "import { cli as dbCli } from '../db-cli.specification.js';",
                "test('a', async () => { await dbCli.exec('db migrate --dry-run'); });",
                "test('b', async () => { await cli.exec('db'); });",
                '',
            ].join('\n'),
        });

        // Then - the chain on `dbCli` names both declared words, so the file holds two subjects
        expect(checkOneSubjectPerSpec(root).map(({ found }) => found)).toStrictEqual([
            'a spec reaching 2 subjects — exec db migrate, exec db',
        ]);
    });

    test('one-subject-per-spec — a method-less route is one subject whatever verbs its tests send, filed by its segments', () => {
        // Given - a POST and a PUT to /mcp in one file under mcp/, in a unit that declares /mcp method-less
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/mcp/transport.spec.ts': [
                "import { api } from '../api.specification.js';",
                "test('a', async () => { await api.post('/mcp', {}); });",
                "test('b', async () => { await api.put('/mcp', {}); });",
                '',
            ].join('\n'),
        });
        const undeclared = checkOneSubjectPerSpec(root).map(({ found }) => found);
        writeFileSync(
            join(dirname(root), 'jterrazz.config.ts'),
            "export default { test: { methodless: ['/mcp'] } };\n",
        );
        writeFileSync(join(dirname(root), 'package.json'), '{}\n');

        // Then - two subjects before the declaration, one filed where it sits after it
        expect(undeclared).toStrictEqual(['a spec reaching 2 subjects — POST /mcp, PUT /mcp']);
        expect([...checkOneSubjectPerSpec(root), ...checkSpecInSubjectFolder(root)]).toStrictEqual(
            [],
        );
    });
});
