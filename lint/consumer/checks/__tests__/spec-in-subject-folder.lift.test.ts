import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

import { specsTree } from '../../../__tests__/subject.fixtures.js';
import { liftGround } from '../spec-in-subject-folder.lift.js';

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
    "    await api.request(file('../__requests__/list.http'));",
    "    expect(text).toMatch(file('../__expected__/listed.http'));",
    "    expect(text).toMatch(file('../__expected__/second.http'));",
    "    read(join(import.meta.dirname, '../__fixtures__/app/index.txt'));",
    '});',
    '',
].join('\n');

describe('liftGround', () => {
    test('liftGround — repoints a lifted entry alone, never a sibling whose name it begins', () => {
        // Given - a listing moved below its leaf reading an app it alone reads, and two siblings named from it that a staying spec reads too
        const root = specsTree({
            'api/orders/__fixtures__/app-v2/index.txt': 'two\n',
            'api/orders/__fixtures__/app.json': '{}\n',
            'api/orders/__fixtures__/app/index.txt': 'app\n',
            'api/orders/list/listing.spec.ts': [
                "test('a', () => {",
                "    read(directory('../__fixtures__/app/'));",
                "    read(file('../__fixtures__/app-v2/index.txt'));",
                "    read(file('../__fixtures__/app.json'));",
                '});',
                '',
            ].join('\n'),
            'api/orders/notes.spec.ts':
                "test('n', () => { read(file('./__fixtures__/app-v2/index.txt')); read(file('./__fixtures__/app.json')); });\n",
        });

        // When - the leaf's ground is lifted
        liftGround(root, join(root, 'api/orders'));

        // Then - the app follows the listing, and the siblings it shares stay named where they stand
        expect(readFileSync(join(root, 'api/orders/list/listing.spec.ts'), 'utf8')).toBe(
            [
                "test('a', () => {",
                "    read(directory('./__fixtures__/app/'));",
                "    read(file('../__fixtures__/app-v2/index.txt'));",
                "    read(file('../__fixtures__/app.json'));",
                '});',
                '',
            ].join('\n'),
        );
    });

    test('liftGround — lifts the ground only readers that left read, repoints them and the module tests, and keeps the rest', () => {
        // Given - a listing moved below its leaf, its ground read by it alone, an unread golden, and an app a staying spec reads
        const root = specsTree({
            'api/orders/__expected__/listed.http': 'HTTP/1.1 200 OK\n',
            'api/orders/__expected__/second.http': 'HTTP/1.1 200 OK\n',
            'api/orders/__expected__/unread.http': 'HTTP/1.1 204 No Content\n',
            'api/orders/__fixtures__/app-two/index.txt': 'two\n',
            'api/orders/__fixtures__/app/index.txt': 'app\n',
            'api/orders/__requests__/list.http': 'GET /orders\n',
            'api/orders/list/listing.spec.ts': LISTING,
            'api/orders/notes.spec.ts':
                "test('n', () => { read(file('./__fixtures__/app-two/index.txt')); });\n",
        });
        const moduleTest = join(dirname(root), 'src/orders.test.ts');
        mkdirSync(dirname(moduleTest), { recursive: true });
        writeFileSync(moduleTest, "read('../specs/api/orders/__expected__/listed.http');\n");

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
                'api/orders/__expected__/listed.http → api/orders/list/__expected__/listed.http',
                'api/orders/__expected__/second.http → api/orders/list/__expected__/second.http',
                'api/orders/__fixtures__/app → api/orders/list/__fixtures__/app',
                'api/orders/__requests__/list.http → api/orders/list/__requests__/list.http',
            ],
            [
                '__expected__/',
                '__expected__/unread.http',
                '__fixtures__/',
                '__fixtures__/app-two/',
                '__fixtures__/app-two/index.txt',
                'list/',
                'list/__expected__/',
                'list/__expected__/listed.http',
                'list/__expected__/second.http',
                'list/__fixtures__/',
                'list/__fixtures__/app/',
                'list/__fixtures__/app/index.txt',
                'list/__requests__/',
                'list/__requests__/list.http',
                'list/listing.spec.ts',
                'notes.spec.ts',
            ],
            LISTING.replaceAll('../_', './_'),
            "read('../specs/api/orders/list/__expected__/listed.http');\n",
        ]);
    });

    test('liftGround — leaves an entry whose new place is taken', () => {
        // Given - a moved listing whose golden's new place holds another
        const root = specsTree({
            'api/orders/__expected__/listed.http': 'HTTP/1.1 200 OK\n',
            'api/orders/list/__expected__/listed.http': 'HTTP/1.1 404 Not Found\n',
            'api/orders/list/listing.spec.ts':
                "expect(text).toMatch(file('../__expected__/listed.http'));\n",
        });

        // When - the leaf's ground is lifted
        // Then - nothing moved
        expect(liftGround(root, join(root, 'api/orders'))).toStrictEqual([]);
    });

    test('liftGround — repoints the document that reads the ground it lifts', () => {
        // Given - a check document, and a spec of the fix command moved under its command, both standing on the project
        const root = specsTree({
            'cli/check/__fixtures__/project/index.ts': 'export {};\n',
            'cli/check/recorded.spec.yaml':
                'description: checks the project\nfixture: ./__fixtures__/project/\nruns:\n    - command: check\n      exit: 0\n',
            'cli/fix/fixed.spec.ts':
                "test('fixes', async () => { await cli.fixture(directory('../check/__fixtures__/project/')).exec('fix'); });\n",
        });

        // When - the check folder's ground is lifted
        const lifted = liftGround(root, join(root, 'cli/check'));

        // Then - the project lands where both readers reach it, and the document names it there
        expect([
            lifted,
            readFileSync(join(root, 'cli/check/recorded.spec.yaml'), 'utf8'),
        ]).toStrictEqual([
            ['cli/check/__fixtures__/project → cli/__fixtures__/project'],
            'description: checks the project\nfixture: ../__fixtures__/project/\nruns:\n    - command: check\n      exit: 0\n',
        ]);
    });
});
