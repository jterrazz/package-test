import { mkdirSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { migrateModuleTestsTo17, migrateTo17 } from './checker-migration.js';

/** A tree written for 16.x, on disk: a specs tree, or (`at: ''`) a member. */
function tree16(files: Record<string, string>, at = 'specs'): string {
    const scratch = mkdtempSync(join(tmpdir(), 'migrate-'));
    const root = join(scratch, at);
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

    test('never runs on a tree C13 finds on 17: its bare strings are values, or refusals kept on purpose', () => {
        // Given - a 17 tree (no 16 folder) whose negative spec hands the verbs what they must refuse
        const source = [
            "import { directory, file } from '@jterrazz/test';",
            "await expect(cli.fixture('cli-app/' as never).exec('build')).rejects.toThrow();",
            "await expect(api.seed('users.sql' as never).request('create.http' as never)).rejects.toThrow();",
            '// @ts-expect-error — a stream is compared as its text',
            "expect(result.stdout).toContain('built');",
            "expect(result.stdout).toMatch(file('./expected/build.txt'));",
            '',
        ].join('\n');
        const root = tree16({
            'cli/build/build.spec.ts': source,
            'cli/build/expected/build.txt': '',
            'fixtures/cli-app/index.ts': '',
        });

        // When - the mover runs
        const migration = migrateTo17(root, renameSync);

        // Then - nothing renamed, nothing rewritten, the spec byte for byte as it was
        expect(migration).toStrictEqual({ renamed: [], rewritten: [] });
        expect(readFileSync(join(root, 'cli/build/build.spec.ts'), 'utf8')).toBe(source);
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
            '_fixtures/shop/index.ts': '',
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
            'cli/build/_expected/build.txt': '',
            'cli/build/build.spec.ts': [
                "import { file } from '@jterrazz/test';",
                "expect(result.stdout).toContain('built');",
                "expect(result.stderr).not.toContain('warning');",
                "expect(result.stdout.grep('users.ts')).toMatch(/users/u);",
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

    test('moves the module tests of a member that still stand on a 16 folder, and only those', () => {
        // Given - a member whose module test reads a 16 golden, beside a nested package and a specs tree it must not walk
        const member = tree16(
            {
                'package.json': '{}\n',
                'packages/nested/package.json': '{}\n',
                'packages/nested/src/x/_expected/y.txt': '',
                'specs/cli/build/build.spec.ts': "expect(result.stdout).toContain('built');\n",
                'src/report/_expected/total.txt': '',
                'src/report/report.test.ts': [
                    "import { match } from '../index.js';",
                    "expect(accessor).toMatch('total.txt');",
                    "expect(accessor.stdout).toContain('total');",
                    '',
                ].join('\n'),
            },
            '',
        );

        // When - the mover runs over the member's module tests
        const migration = migrateModuleTestsTo17(member, renameSync);

        // Then - the folder is bare, the golden is named by its path, the stream compares its text; the nested package and specs/ are untouched
        expect(migration).toStrictEqual({
            renamed: ['src/report/_expected → src/report/expected'],
            rewritten: ['src/report/report.test.ts'],
        });
        expect(readFileSync(join(member, 'src/report/report.test.ts'), 'utf8')).toBe(
            [
                "import { file } from '@jterrazz/test';",
                '',
                "import { match } from '../index.js';",
                "expect(accessor).toMatch(file('./expected/total.txt'));",
                "expect(accessor.stdout.text).toContain('total');",
                '',
            ].join('\n'),
        );
        expect(readFileSync(join(member, 'specs/cli/build/build.spec.ts'), 'utf8')).toBe(
            "expect(result.stdout).toContain('built');\n",
        );
    });

    test('leaves the module tests of a member on 17 as they are', () => {
        // Given - a member whose module tests stand on bare ground only
        const member = tree16(
            {
                'package.json': '{}\n',
                'src/report/expected/total.txt': '',
                'src/report/report.test.ts': "expect(() => seed('rows.sql' as never)).toThrow();\n",
            },
            '',
        );

        // Then - nothing to rename, nothing to rewrite
        expect(migrateModuleTestsTo17(member, renameSync)).toStrictEqual({
            renamed: [],
            rewritten: [],
        });
    });

    test('a directive naming a renamed rule names its new id, and the line it covers reads the raw capture', () => {
        // Given - a 16 tree whose tests suppress D8w by its 16 id, on the next line and on its own
        const root = tree16({
            'cli/build/_expected/build.txt': '',
            'cli/build/build.spec.ts': [
                '// oxlint-disable-next-line jterrazz/d8w-text-bypass -- asserts the colour codes themselves',
                "expect(result.stdout.text).toContain('[31m');",
                "expect(result.stderr.text).not.toContain('[0m'); // oxlint-disable-line jterrazz/d8w-text-bypass -- same",
                '// oxlint-disable-next-line jterrazz/j2-no-sleep -- another rule',
                "expect(result.stdout.text).toContain('built');",
                '',
            ].join('\n'),
        });

        // When - the mover runs
        migrateTo17(root, renameSync);

        // Then - the two directives name d8w-raw-bypass and their lines read .raw; the other directive, and its line, stay
        expect(readFileSync(join(root, 'cli/build/build.spec.ts'), 'utf8')).toBe(
            [
                '// oxlint-disable-next-line jterrazz/d8w-raw-bypass -- asserts the colour codes themselves',
                "expect(result.stdout.raw).toContain('[31m');",
                "expect(result.stderr.raw).not.toContain('[0m'); // oxlint-disable-line jterrazz/d8w-raw-bypass -- same",
                '// oxlint-disable-next-line jterrazz/j2-no-sleep -- another rule',
                "expect(result.stdout.text).toContain('built');",
                '',
            ].join('\n'),
        );
    });

    test("a directive in a tree on 17 is not the mover's: it is left as written", () => {
        // Given - a 17 tree (no 16 folder) that still names the 16 id
        const source = [
            '// oxlint-disable-next-line jterrazz/d8w-text-bypass -- left by hand',
            "expect(result.stdout.text).toContain('built');",
            '',
        ].join('\n');
        const root = tree16({ 'cli/build/build.spec.ts': source });

        // When - the mover runs
        migrateTo17(root, renameSync);

        // Then - untouched: the toolchain's Suppressions pass names a directive naming no rule
        expect(readFileSync(join(root, 'cli/build/build.spec.ts'), 'utf8')).toBe(source);
    });

    test('the gate is per file: a 17 file is left byte for byte beside a 16 one in the same tree', () => {
        // Given - one leaf still on 16 (its golden folder), and another leaf on 17 whose negative spec keeps the 16 spellings on purpose
        const refusal = [
            "import { file } from '@jterrazz/test';",
            "await expect(cli.fixture('cli-app/' as never).exec('build')).rejects.toThrow();",
            '// @ts-expect-error — a stream is compared as its text',
            "expect(result.stdout).toContain('built');",
            "expect(result.stdout).toMatch(file('./expected/refused.txt'));",
            '',
        ].join('\n');
        const root = tree16({
            'cli/build/_expected/build.txt': '',
            'cli/build/build.spec.ts': "expect(result.stdout).toMatch('build.txt');\n",
            'cli/refusal/expected/refused.txt': '',
            'cli/refusal/refusal.spec.ts': refusal,
            'fixtures/cli-app/index.ts': '',
        });

        // When - the mover runs
        const migration = migrateTo17(root, renameSync);

        // Then - the 16 leaf moves; the 17 leaf is not the mover's, whatever its tree holds
        expect(migration.rewritten).toStrictEqual(['cli/build/build.spec.ts']);
        expect(readFileSync(join(root, 'cli/refusal/refusal.spec.ts'), 'utf8')).toBe(refusal);
    });

    test('a 16 pool reaches only the files that name it', () => {
        // Given - a 16 pool, a spec naming it by the 16 prefix, and a 17 spec that does not
        const other = "await expect(api.seed('users.sql' as never)).rejects.toThrow();\n";
        const root = tree16({
            '_fixtures/shop/index.ts': '',
            'api/orders/orders.spec.ts': other,
            'cli/build/build.spec.ts': "await cli.fixture('$FIXTURES/shop/').exec('build');\n",
        });

        // When - the mover runs
        const migration = migrateTo17(root, renameSync);

        // Then - the pool is bare, the spec that names it moves, the other is left
        expect(migration.rewritten).toStrictEqual(['cli/build/build.spec.ts']);
        expect(readFileSync(join(root, 'api/orders/orders.spec.ts'), 'utf8')).toBe(other);
    });

    test('a stream asserted empty is an empty text, and a table keeps its matcher', () => {
        // Given - 16's toBeEmpty on streams, awaited and negated, beside a table's
        const root = tree16({
            'integration/call/_expected/x.txt': '',
            'integration/call/call.spec.ts': [
                'await expect(result.error).toBeEmpty();',
                'await expect(result.stdout.grep(/warn/u)).not.toBeEmpty();',
                "await expect(result.table('orders')).toBeEmpty();",
                '',
            ].join('\n'),
        });

        // When - the mover runs
        migrateTo17(root, renameSync);

        // Then - vitest's own toBe('') on the text, the await gone with the promise; the table's line stays
        expect(readFileSync(join(root, 'integration/call/call.spec.ts'), 'utf8')).toBe(
            [
                "expect(result.error.text).toBe('');",
                "expect(result.stdout.grep(/warn/u).text).not.toBe('');",
                "await expect(result.table('orders')).toBeEmpty();",
                '',
            ].join('\n'),
        );
    });
});
