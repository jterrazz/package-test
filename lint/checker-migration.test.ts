import { mkdirSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { migrateTo17 } from './checker-migration.js';

/** A specs tree written for 16.x, on disk. */
function tree16(files: Record<string, string>): string {
    const scratch = mkdtempSync(join(tmpdir(), 'migrate-'));
    const root = join(scratch, 'specs');
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), content);
    }
    return root;
}

const SPEC = [
    "import { api, cli } from '../api.specification.js';",
    '',
    "const a = await api.seed('users.sql', { database: 'db' }).request('create.http');",
    "expect(a.response).toMatch('created.http');",
    "expect(message).toMatch('not a file');",
    "const b = await cli.fixture('$FIXTURES/shop/').fixture('config.toml').exec('build');",
    "await expect(b.filesystem).toMatch('scaffold');",
    "await cli.run('case.spec.yaml');",
    '',
].join('\n');

describe('the 16 → 17 mover (C13 --fix)', () => {
    test('renames the ground folders and names every file by its path', () => {
        // Given - a leaf with its four ground folders and a spec on the 16 verbs
        const root = tree16({
            '_fixtures/shop/index.ts': '',
            'api/users/_expected/created.http': 'HTTP/1.1 201\n',
            'api/users/_expected/scaffold/out.txt': '',
            'api/users/_fixtures/config.toml': '',
            'api/users/_requests/create.http': 'POST /users\n',
            'api/users/_seeds/users.sql': '',
            'api/api.specification.ts': "import { specification } from '@jterrazz/test';\n",
            'api/users/users.spec.ts': SPEC,
            'cli/build/case.spec.yaml': 'description: x\nfixture: $FIXTURES/shop/\nruns: []\n',
        });

        // When - the mover runs
        const migration = migrateTo17(root, renameSync);

        // Then - the folders are bare, the disk is named by file()/directory(), a value stays a value, and the wrappers are imported from the entry the specification uses
        expect(migration.renamed).toHaveLength(5);
        expect(readFileSync(join(root, 'api/users/users.spec.ts'), 'utf8')).toBe(
            [
                "import { directory, file } from '@jterrazz/test';",
                '',
                "import { api, cli } from '../api.specification.js';",
                '',
                "const a = await api.seed(file('./seeds/users.sql'), { database: 'db' }).request(file('./requests/create.http'));",
                "expect(a.response).toMatch(file('./expected/created.http'));",
                "expect(message).toMatch('not a file');",
                "const b = await cli.fixture(directory('../../fixtures/shop/')).fixture(file('./fixtures/config.toml')).exec('build');",
                "await expect(b.filesystem).toMatch(directory('./expected/scaffold/'));",
                "await cli.run(file('./case.spec.yaml'));",
                '',
            ].join('\n'),
        );
        expect(readFileSync(join(root, 'cli/build/case.spec.yaml'), 'utf8')).toContain(
            'fixture: ../../fixtures/shop/',
        );
    });

    test('is idempotent on a tree already on 17', () => {
        // Given - a tree the mover already moved
        const root = tree16({
            'api/users/expected/created.http': '',
            'api/users/users.spec.ts': [
                "import { file } from '@jterrazz/test';",
                "expect(a).toMatch(file('./expected/created.http'));",
                '',
            ].join('\n'),
        });

        // Then - nothing to rename, nothing to rewrite
        expect(migrateTo17(root, renameSync)).toStrictEqual({ renamed: [], rewritten: [] });
    });

    test('moves the prototype verbs, and a path spelled in full against a 16 folder', () => {
        // Given - the intermediate form: …File verbs, old folder names, a relative entry import
        const root = tree16({
            'api/users/_seeds/users.sql': '',
            'api/users/users.spec.ts': [
                "import { match } from '../../../src/index.js';",
                "api.seedFile('./_seeds/users.sql');",
                "expect(r.stdout).toMatchFile('./expected/out.txt', { frozen: true });",
                '',
            ].join('\n'),
        });

        // When - the mover runs
        migrateTo17(root, renameSync);

        // Then - the verb takes the wrapper, the path follows the folder, the entry import grows the names
        expect(readFileSync(join(root, 'api/users/users.spec.ts'), 'utf8')).toBe(
            [
                "import { file, match } from '../../../src/index.js';",
                "api.seed(file('./seeds/users.sql'));",
                "expect(r.stdout).toMatch(file('./expected/out.txt'), { frozen: true });",
                '',
            ].join('\n'),
        );
    });

    test('leaves what it cannot read as a 16 file name, and moves a document listing its fixtures', () => {
        // Given - a raw SQL string, a non-http request argument, an unknown marker, and a document with a fixture list
        const root = tree16({
            'cli/build/case.spec.yaml': [
                'description: x',
                'fixture:',
                '    - $FIXTURES/shop/',
                '    - config.toml',
                'runs: []',
                '',
            ].join('\n'),
            'cli/build/build.spec.ts': [
                "db.seed('DELETE FROM users');",
                "server.request('GET');",
                "cli.fixture('$OTHER/x/');",
                '',
            ].join('\n'),
        });

        // When - the mover runs
        migrateTo17(root, renameSync);

        // Then - none of the three is a file name, so all three stay; the list moves entry by entry
        expect(readFileSync(join(root, 'cli/build/build.spec.ts'), 'utf8')).toBe(
            [
                "db.seed('DELETE FROM users');",
                "server.request('GET');",
                "cli.fixture('$OTHER/x/');",
                '',
            ].join('\n'),
        );
        expect(readFileSync(join(root, 'cli/build/case.spec.yaml'), 'utf8')).toContain(
            ['fixture:', '    - ../../fixtures/shop/', '    - ./fixtures/config.toml'].join('\n'),
        );
    });

    test('never enters ground: a fixture project keeps the 16 folders it is made of', () => {
        // Given - a pool entry and a leaf fixture that are 16 trees ON PURPOSE (a negative case's input)
        const root = tree16({
            'fixtures/old-tree/specs/app/_expected/out.txt': '',
            'lint/rule/fixtures/case/specs/app/_seeds/x.sql': '',
            'lint/rule/rule.test.ts': '',
        });

        // When - the mover runs
        const migration = migrateTo17(root, renameSync);

        // Then - nothing inside ground moved
        expect(migration.renamed).toStrictEqual([]);
    });

    test('a stream compared as a value reads its text, and a golden stays on the accessor', () => {
        // Given - the 16 value matchers on stream accessors, beside a golden and a text already read
        const root = tree16({
            'cli/build/build.spec.ts': [
                "import { file } from '@jterrazz/test';",
                "expect(result.stdout.text).toContain('built');",
                "expect(result.stderr.text).not.toContain('warning');",
                "expect(result.stdout.grep('users.ts').text).toMatch(/users/u);",
                'expect(',
                '    result.tree,',
                ").toContain('button');",
                "expect(result.stdout).toMatch(file('./expected/build.txt'));",
                "expect(result.stdout.text).toContain('done');",
                "expect(result.body).toContain('x');",
                '',
            ].join('\n'),
        });

        // When - the mover runs
        migrateTo17(root, renameSync);

        // Then - each value comparison reads .text; the golden, the text, and an ambiguous member stay
        expect(readFileSync(join(root, 'cli/build/build.spec.ts'), 'utf8')).toBe(
            [
                "import { file } from '@jterrazz/test';",
                "expect(result.stdout.text).toContain('built');",
                "expect(result.stderr.text).not.toContain('warning');",
                "expect(result.stdout.grep('users.ts').text).toMatch(/users/u);",
                'expect(',
                '    result.tree.text,',
                ").toContain('button');",
                "expect(result.stdout).toMatch(file('./expected/build.txt'));",
                "expect(result.stdout.text).toContain('done');",
                "expect(result.body).toContain('x');",
                '',
            ].join('\n'),
        );
    });
});
