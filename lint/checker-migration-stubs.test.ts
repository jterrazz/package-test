import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    renameSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { migrateStubs } from './checker-migration-stubs.js';

/** A tree on disk: a specs tree, or (`at: ''`) a member. */
function tree(files: Record<string, string>, at = 'specs'): string {
    const scratch = mkdtempSync(join(tmpdir(), 'migrate-stubs-'));
    const root = join(scratch, at);
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), content);
    }
    return root;
}

/** A file of the tree, read back. */
function read(root: string, path: string): string {
    return readFileSync(join(root, path), 'utf8');
}

const UNIT_16 = [
    "import { defineContract, http } from '@jterrazz/test';",
    "import type { Contract } from '@jterrazz/test';",
    '',
    'export default function events(page: number): Contract {',
    "    return defineContract({ request: http.get('/events', { query: { page: String(page) } }), response: http.json({ page }) });",
    '}',
    '',
].join('\n');

const FACADE_16 = [
    "import { defineContracts as compose } from '@jterrazz/test';",
    "import type { Contracts } from '@jterrazz/test';",
    '',
    "import events from './http/events.js';",
    '',
    'export const newsroom: Contracts = compose(events(1));',
    '',
].join('\n');

const SPEC_16 = [
    "import { expect, test } from 'vitest';",
    '',
    "import { api } from '../api.specification.js';",
    "import { newsroom } from './contracts/newsroom.contracts.js';",
    '',
].join('\n');

describe('the stubs half of the 16 → 17 mover', () => {
    test('moves a specs tree: the folder, its facades, the paths that named them and the names it imports', () => {
        // Given - a leaf declaring its replies the 16 way
        const root = tree({
            'api/news/contracts/http/events.ts': UNIT_16,
            'api/news/contracts/newsroom.contracts.ts': FACADE_16,
            'api/news/list.spec.ts': SPEC_16,
        });

        // When - the mover runs
        const migration = migrateStubs(root, 'specs', renameSync);

        // Then - the tree is on 17: the folder and the facade renamed, every name and path the files wrote follows, an alias kept as the file wrote it
        expect(migration).toStrictEqual({
            renamed: [
                'api/news/contracts → api/news/stubs',
                'api/news/stubs/newsroom.contracts.ts → api/news/stubs/newsroom.stubs.ts',
            ],
            rewritten: [
                'api/news/list.spec.ts',
                'api/news/stubs/http/events.ts',
                'api/news/stubs/newsroom.stubs.ts',
            ],
        });
        expect(read(root, 'api/news/list.spec.ts')).toBe(
            SPEC_16.replace("'./contracts/newsroom.contracts.js'", "'./stubs/newsroom.stubs.js'"),
        );
        expect(read(root, 'api/news/stubs/http/events.ts')).toBe(
            [
                "import { defineStub, http } from '@jterrazz/test';",
                "import type { Stub } from '@jterrazz/test';",
                '',
                'export default function events(page: number): Stub {',
                "    return defineStub({ request: http.get('/events', { query: { page: String(page) } }), response: http.json({ page }) });",
                '}',
                '',
            ].join('\n'),
        );
        expect(read(root, 'api/news/stubs/newsroom.stubs.ts')).toBe(
            [
                "import { defineStubs as compose } from '@jterrazz/test';",
                "import type { Stubs } from '@jterrazz/test';",
                '',
                "import events from './http/events.js';",
                '',
                'export const newsroom: Stubs = compose(events(1));',
                '',
            ].join('\n'),
        );
    });

    test("moves a member's stubs beside its module tests, and leaves the product's own contracts", () => {
        // Given - a module test standing on a 16 facade, and a product folder that happens to be named contracts
        const root = tree(
            {
                'src/legal/contracts/terms.ts': 'export type Contract = { signed: boolean };\n',
                'src/legal/sign.ts':
                    "import type { Contract } from './contracts/terms.js';\n\nexport const sign = (contract: Contract): Contract => ({ ...contract, signed: true });\n",
                'src/news/contracts/http/events.ts': UNIT_16,
                'src/news/contracts/newsroom.contracts.ts': FACADE_16,
                'src/news/news.test.ts':
                    "import { intercept } from '@jterrazz/test';\n\nimport { newsroom } from './contracts/newsroom.contracts.js';\n\nawait using _ = await intercept(newsroom);\n",
            },
            '',
        );

        // When - the member pass runs
        const migration = migrateStubs(root, 'member', renameSync);

        // Then - the test's world moved and is named where it went; the product's folder and its own `Contract` type are untouched
        expect(migration.renamed).toStrictEqual([
            'src/news/contracts → src/news/stubs',
            'src/news/stubs/newsroom.contracts.ts → src/news/stubs/newsroom.stubs.ts',
        ]);
        expect(read(root, 'src/news/news.test.ts')).toContain(
            "import { newsroom } from './stubs/newsroom.stubs.js';",
        );
        expect(existsSync(join(root, 'src/legal/contracts/terms.ts'))).toBe(true);
        expect(read(root, 'src/legal/sign.ts')).toContain(
            "import type { Contract } from './contracts/terms.js';",
        );
    });
});
