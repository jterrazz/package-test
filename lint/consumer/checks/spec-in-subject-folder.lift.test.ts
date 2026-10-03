import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

import { specsTree } from '../../kit/testing/subject.fixtures.js';
import { liftGround } from './spec-in-subject-folder.lift.js';

function entriesUnder(root: string): string[] {
    return readdirSync(root, { recursive: true, withFileTypes: true })
        .map(
            (entry) =>
                relative(root, join(entry.parentPath, entry.name)) +
                (entry.isDirectory() ? '/' : ''),
        )
        .toSorted();
}

const LISTING = [
    "test('a', async () => {",
    "    await api.request(file('../_requests/list.http'));",
    "    expect(text).toMatch(file('../_expected/listed.http'));",
    "    expect(text).toMatch(file('../_expected/second.http'));",
    "    read(join(import.meta.dirname, '../_fixtures/app/index.txt'));",
    '});',
    '',
].join('\n');

describe('liftGround', () => {
    test('lifts the ground only readers that left read, repoints them and the module tests, and keeps the rest', () => {
        // Given - a listing moved below its leaf, its ground read by it alone, an unread golden, and an app a staying spec reads
        const root = specsTree({
            'api/orders/_expected/listed.http': 'HTTP/1.1 200 OK\n',
            'api/orders/_expected/second.http': 'HTTP/1.1 200 OK\n',
            'api/orders/_expected/unread.http': 'HTTP/1.1 204 No Content\n',
            'api/orders/_fixtures/app-two/index.txt': 'two\n',
            'api/orders/_fixtures/app/index.txt': 'app\n',
            'api/orders/_requests/list.http': 'GET /orders\n',
            'api/orders/list/listing.spec.ts': LISTING,
            'api/orders/notes.spec.ts':
                "test('n', () => { read(file('./_fixtures/app-two/index.txt')); });\n",
        });
        const moduleTest = join(dirname(root), 'src/orders.test.ts');
        mkdirSync(dirname(moduleTest), { recursive: true });
        writeFileSync(moduleTest, "read('../specs/api/orders/_expected/listed.http');\n");

        // When - the leaf's ground is lifted
        const lifted = liftGround(root, join(root, 'api/orders'));

        // Then - what left with the listing follows it, each reader naming the new place, and the emptied folder is gone
        expect([
            lifted,
            entriesUnder(join(root, 'api/orders')),
            readFileSync(join(root, 'api/orders/list/listing.spec.ts'), 'utf8'),
            readFileSync(moduleTest, 'utf8'),
        ]).toStrictEqual([
            [
                'api/orders/_expected/listed.http → api/orders/list/_expected/listed.http',
                'api/orders/_expected/second.http → api/orders/list/_expected/second.http',
                'api/orders/_fixtures/app → api/orders/list/_fixtures/app',
                'api/orders/_requests/list.http → api/orders/list/_requests/list.http',
            ],
            [
                '_expected/',
                '_expected/unread.http',
                '_fixtures/',
                '_fixtures/app-two/',
                '_fixtures/app-two/index.txt',
                'list/',
                'list/_expected/',
                'list/_expected/listed.http',
                'list/_expected/second.http',
                'list/_fixtures/',
                'list/_fixtures/app/',
                'list/_fixtures/app/index.txt',
                'list/_requests/',
                'list/_requests/list.http',
                'list/listing.spec.ts',
                'notes.spec.ts',
            ],
            LISTING.replaceAll('../_', './_'),
            "read('../specs/api/orders/list/_expected/listed.http');\n",
        ]);
    });

    test('leaves an entry whose new place is taken', () => {
        // Given - a moved listing whose golden's new place holds another
        const root = specsTree({
            'api/orders/_expected/listed.http': 'HTTP/1.1 200 OK\n',
            'api/orders/list/_expected/listed.http': 'HTTP/1.1 404 Not Found\n',
            'api/orders/list/listing.spec.ts':
                "expect(text).toMatch(file('../_expected/listed.http'));\n",
        });

        // When - the leaf's ground is lifted
        // Then - nothing moved
        expect(liftGround(root, join(root, 'api/orders'))).toStrictEqual([]);
    });

    test('repoints the document that reads the ground it lifts', () => {
        // Given - a check document, and a spec of the fix command moved under its command, both standing on the project
        const root = specsTree({
            'cli/check/_fixtures/project/index.ts': 'export {};\n',
            'cli/check/recorded.spec.yaml':
                'description: checks the project\nfixture: ./_fixtures/project/\nruns:\n    - command: check\n      exit: 0\n',
            'cli/fix/fixed.spec.ts':
                "test('fixes', async () => { await cli.fixture(directory('../check/_fixtures/project/')).exec('fix'); });\n",
        });

        // When - the check folder's ground is lifted
        const lifted = liftGround(root, join(root, 'cli/check'));

        // Then - the project lands where both readers reach it, and the document names it there
        expect([
            lifted,
            readFileSync(join(root, 'cli/check/recorded.spec.yaml'), 'utf8'),
        ]).toStrictEqual([
            ['cli/check/_fixtures/project → cli/_fixtures/project'],
            'description: checks the project\nfixture: ../_fixtures/project/\nruns:\n    - command: check\n      exit: 0\n',
        ]);
    });
});
