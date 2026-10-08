import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import { documentReferences, RELATIVE_LITERAL } from '../ground-readers.js';

const lines = (...text: string[]): string => text.join('\n');

const leadsOf = (text: string): string[] =>
    [...text.matchAll(RELATIVE_LITERAL)].map(
        (found) => `${found.groups?.lead ?? ''}${found.groups?.path ?? ''}`,
    );

describe('ground-readers', () => {
    test('the relative literal — reads a relative path after each lead that names a module or a path beside the file', () => {
        // Given - a relative path behind every lead, and behind calls that only share a name
        const text = lines(
            "file('./a.json'); directory('../b/');",
            "import x from './c.js'; await import('../d.js');",
            "join(import.meta.dirname, './e.txt');",
            "vi.mock('../f.js'); vi.doMock('./g.js'); vi.unmock('./h.js');",
            "vi.doUnmock('./i.js'); vi.importActual('./j.js'); vi.importMock('./k.js');",
            "new URL('./l.json', import.meta.url);",
            "new URL('./m.json', base); other.vi.mock('./n.js'); api.file('./o.json');",
            "file(  './q.json'); import   y from   './r.js'; import(  './s.js');",
            "join(import.meta.dirname,'./t.txt'); vi.mock(  './u.js'); new URL(  './v.json'  ,  import.meta.url);",
            "new URL('./w.json',import.meta.url); new URL('./x.json', import.meta.urls);",
            "new  URL('./y.json', import.meta.url);",
            "file('p.json');",
        );

        // Then - each lead and its path, and none of the lookalikes
        expect(leadsOf(text)).toStrictEqual([
            'file(./a.json',
            'directory(../b/',
            'from ./c.js',
            'import(../d.js',
            'import.meta.dirname, ./e.txt',
            'vi.mock(../f.js',
            'vi.doMock(./g.js',
            'vi.unmock(./h.js',
            'vi.doUnmock(./i.js',
            'vi.importActual(./j.js',
            'vi.importMock(./k.js',
            'new URL(./l.json',
            'file(  ./q.json',
            'from   ./r.js',
            'import(  ./s.js',
            'import.meta.dirname,./t.txt',
            'vi.mock(  ./u.js',
            'new URL(  ./v.json',
            'new URL(./w.json',
            'new  URL(./y.json',
        ]);
    });

    test("documentReferences — reads each document's fixture lines, parsed or refused by the grammar", () => {
        // Given - a document the grammar reads, and one it refuses, each naming a fixture
        const root = packageWith({
            'specs/api/bad.spec.yaml': lines(
                'description: reads its expected file',
                "fixture: './__expected__/x.json'",
                'fixture:./__fixtures__/bare.json',
                'fixture:   "./__fixtures__/spaced.json"   ',
                '    fixture: ./__fixtures__/indented.json',
                'fixture: ./__fixtures__/commented.json # the app',
                'fixture: ./__fixtures__/two words.json',
                'fixture: \'./__fixtures__/unpaired.json"',
                'runs: nope',
                '',
            ),
            'specs/api/good.spec.yaml': lines(
                'description: reads its app',
                'fixture: ./__fixtures__/app/',
                'runs:',
                '    - command: echo',
                '      exit: 0',
                '',
            ),
        });
        const specs = join(root, 'specs');

        // Then - both are read, each from its own folder
        expect(
            documentReferences(specs)
                .map(
                    ({ file, target }) =>
                        `${file.slice(specs.length)} → ${target.slice(specs.length)}`,
                )
                .toSorted(),
        ).toStrictEqual([
            '/api/bad.spec.yaml → /api/__expected__/x.json',
            '/api/bad.spec.yaml → /api/__fixtures__/bare.json',
            '/api/bad.spec.yaml → /api/__fixtures__/commented.json',
            '/api/bad.spec.yaml → /api/__fixtures__/spaced.json',
            '/api/good.spec.yaml → /api/__fixtures__/app',
        ]);
    });
});
