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
    "const a = await api.seed('users.sql').request('create.http');",
    "expect(a.response).toMatch('created.http');",
    "expect(message).toMatch('not a file');",
    "const b = await cli.fixture('$FIXTURES/shop/').fixture('config.toml').exec('build');",
    "await expect(b.filesystem).toMatch('scaffold');",
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
            'api/users/users.spec.ts': SPEC,
            'cli/build/case.spec.yaml': 'description: x\nfixture: $FIXTURES/shop/\nruns: []\n',
        });

        // When - the mover runs
        const migration = migrateTo17(root, renameSync);

        // Then - the folders are bare, the verbs name paths, and a value stays a value
        expect(migration.renamed).toHaveLength(5);
        expect(readFileSync(join(root, 'api/users/users.spec.ts'), 'utf8')).toBe(
            [
                "const a = await api.seedFile('./seeds/users.sql').requestFile('./requests/create.http');",
                "expect(a.response).toMatchFile('./expected/created.http');",
                "expect(message).toMatch('not a file');",
                "const b = await cli.fixtureDirectory('../../fixtures/shop/').fixtureFile('./fixtures/config.toml').exec('build');",
                "await expect(b.filesystem).toMatchDirectory('./expected/scaffold/');",
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
            'api/users/users.spec.ts': "expect(a).toMatchFile('./expected/created.http');\n",
        });

        // Then - nothing to rename, nothing to rewrite
        expect(migrateTo17(root, renameSync)).toStrictEqual({ renamed: [], rewritten: [] });
    });

    test('moves a path spelled in full against a 16 folder', () => {
        // Given - the intermediate form: new verbs, old folder names
        const root = tree16({
            'api/users/_seeds/users.sql': '',
            'api/users/users.spec.ts': "api.seedFile('./_seeds/users.sql');\n",
        });

        // When - the mover runs
        migrateTo17(root, renameSync);

        // Then - the path follows the folder
        expect(readFileSync(join(root, 'api/users/users.spec.ts'), 'utf8')).toBe(
            "api.seedFile('./seeds/users.sql');\n",
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
});
