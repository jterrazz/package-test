import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../kit/testing/package-tree.fixtures.js';
import { checkGroundBesideItsOnlyReader } from './ground-beside-its-only-reader.js';

const reads = (what: string): string => `test('a', () => { read(${what}); });\n`;

describe('checkGroundBesideItsOnlyReader', () => {
    test('a ground one test alone of several reads is named, by any way the test reads it', () => {
        // Given - leaves whose ground one test reads by a file name, by the folder, or through a computed golden
        const root = packageWith({
            'specs/website/computed/_expected/x.txt': 'x\n',
            'specs/website/computed/a.spec.ts': [
                'expect(page).toMatch(file(`./_expected/$',
                '{name}`));\n',
            ].join(''),
            'specs/website/computed/b.spec.ts': reads('1'),
            'specs/website/folder/_seeds/rows.sql': '\n',
            'specs/website/folder/a.spec.ts': reads("'./_seeds/'"),
            'specs/website/folder/b.spec.ts': reads('1'),
            'specs/website/home/_expected/home.html': '<p/>\n',
            'specs/website/home/_expected/other.html': '<p/>\n',
            'specs/website/home/sub/x.txt': 'x\n',
            'specs/website/home/a.spec.ts': reads("'home.html', './sub/x.txt'"),
            'specs/website/home/b.spec.ts': reads('1'),
        });

        // Then - each such ground
        expect(checkGroundBesideItsOnlyReader(join(root, 'specs'))).toStrictEqual([
            {
                fix: 'give `a.spec.ts` a domain folder of its own, and move `_expected/` into it',
                found: '`_expected/`, read by `a.spec.ts` alone of the tests beside it',
                line: 1,
                path: 'website/computed/_expected',
                rule: 'ground-beside-its-only-reader',
            },
            {
                fix: 'give `a.spec.ts` a domain folder of its own, and move `_seeds/` into it',
                found: '`_seeds/`, read by `a.spec.ts` alone of the tests beside it',
                line: 1,
                path: 'website/folder/_seeds',
                rule: 'ground-beside-its-only-reader',
            },
            {
                fix: 'give `a.spec.ts` a domain folder of its own, and move `_expected/` into it',
                found: '`_expected/`, read by `a.spec.ts` alone of the tests beside it',
                line: 1,
                path: 'website/home/_expected',
                rule: 'ground-beside-its-only-reader',
            },
        ]);
    });

    test('a ground is left where its folder is a subject, where one test or none sits, where every test reads it, or where it is empty', () => {
        // Given - each of those shapes, and tests the walk never counts
        const root = packageWith({
            'specs/api/orders/_expected/x.txt': 'x\n',
            'specs/api/orders/a.spec.ts': reads("'x.txt'"),
            'specs/api/orders/b.spec.ts': reads('1'),
            'specs/website/both/_expected/x.txt': 'x\n',
            'specs/website/both/a.spec.ts': reads("'x.txt'"),
            'specs/website/both/b.spec.ts': reads("'x.txt'"),
            'specs/website/node_modules/m/_expected/x.txt': 'x\n',
            'specs/website/node_modules/m/a.spec.ts': reads("'x.txt'"),
            'specs/website/node_modules/m/b.spec.ts': reads('1'),
            'specs/website/one/_expected/x.txt': 'x\n',
            'specs/website/one/a.spec.ts': reads("'x.txt'"),
            'specs/website/rendered/_expected/x.txt': 'x\n',
            'specs/website/rendered/a.test.tsx': reads("'x.txt'"),
            'specs/website/rendered/b.test.tsx': reads('1'),
            'specs/website/rendered/c.spec.ts/x.txt': 'a folder, not a test\n',
            'specs/website/void/a.spec.ts': reads("'./_expected/'"),
            'specs/website/void/b.spec.ts': reads('1'),
        });
        mkdirSync(join(root, 'specs/website/void/_expected'));

        // Then - nothing
        expect(checkGroundBesideItsOnlyReader(join(root, 'specs'))).toStrictEqual([]);
    });
});
