import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../kit/testing/package-tree.fixtures.js';
import { checkGroundBesideItsOnlyReader } from '../ground-beside-its-only-reader.js';

const reads = (what: string): string => `test('a', () => { read(${what}); });\n`;

describe('checkGroundBesideItsOnlyReader', () => {
    test('a ground one test alone of several reads is named, by any way the test reads it', () => {
        // Given - leaves whose ground one test reads by a file name, by the folder, or through a computed golden
        const root = packageWith({
            'specs/website/computed/__expected__/x.txt': 'x\n',
            'specs/website/computed/a.spec.ts': [
                'expect(page).toMatch(file(`./__expected__/$',
                '{name}`));\n',
            ].join(''),
            'specs/website/computed/b.spec.ts': reads('1'),
            'specs/website/folder/__seeds__/rows.sql': '\n',
            'specs/website/folder/a.spec.ts': reads("'./__seeds__/'"),
            'specs/website/folder/b.spec.ts': reads('1'),
            'specs/website/home/__expected__/home.html': '<p/>\n',
            'specs/website/home/__expected__/other.html': '<p/>\n',
            'specs/website/home/sub/x.txt': 'x\n',
            'specs/website/home/a.spec.ts': reads("'home.html', './sub/x.txt'"),
            'specs/website/home/b.spec.ts': reads('1'),
        });

        // Then - each such ground
        expect(checkGroundBesideItsOnlyReader(join(root, 'specs'))).toStrictEqual([
            {
                fix: 'give `a.spec.ts` a domain folder of its own, and move `__expected__/` into it',
                found: '`__expected__/`, read by `a.spec.ts` alone of the tests beside it',
                line: 1,
                path: 'website/computed/__expected__',
                rule: 'ground-beside-its-only-reader',
            },
            {
                fix: 'give `a.spec.ts` a domain folder of its own, and move `__seeds__/` into it',
                found: '`__seeds__/`, read by `a.spec.ts` alone of the tests beside it',
                line: 1,
                path: 'website/folder/__seeds__',
                rule: 'ground-beside-its-only-reader',
            },
            {
                fix: 'give `a.spec.ts` a domain folder of its own, and move `__expected__/` into it',
                found: '`__expected__/`, read by `a.spec.ts` alone of the tests beside it',
                line: 1,
                path: 'website/home/__expected__',
                rule: 'ground-beside-its-only-reader',
            },
        ]);
    });

    test('a ground is left where its folder is a subject, where one test or none sits, where every test reads it, or where it is empty', () => {
        // Given - each of those shapes, and tests the walk never counts
        const root = packageWith({
            'specs/api/orders/__expected__/x.txt': 'x\n',
            'specs/api/orders/a.spec.ts': reads("'x.txt'"),
            'specs/api/orders/b.spec.ts': reads('1'),
            'specs/website/both/__expected__/x.txt': 'x\n',
            'specs/website/both/a.spec.ts': reads("'x.txt'"),
            'specs/website/both/b.spec.ts': reads("'x.txt'"),
            'specs/website/node_modules/m/__expected__/x.txt': 'x\n',
            'specs/website/node_modules/m/a.spec.ts': reads("'x.txt'"),
            'specs/website/node_modules/m/b.spec.ts': reads('1'),
            'specs/website/one/__expected__/x.txt': 'x\n',
            'specs/website/one/a.spec.ts': reads("'x.txt'"),
            'specs/website/rendered/__expected__/x.txt': 'x\n',
            'specs/website/rendered/a.test.tsx': reads("'x.txt'"),
            'specs/website/rendered/b.test.tsx': reads('1'),
            'specs/website/rendered/c.spec.ts/x.txt': 'a folder, not a test\n',
            'specs/website/void/a.spec.ts': reads("'./__expected__/'"),
            'specs/website/void/b.spec.ts': reads('1'),
        });
        mkdirSync(join(root, 'specs/website/void/__expected__'));

        // Then - nothing
        expect(checkGroundBesideItsOnlyReader(join(root, 'specs'))).toStrictEqual([]);
    });
});
