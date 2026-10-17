import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import { checkNoUnusedGround } from '../no-unused-ground.js';

const DEAD = {
    'specs/api/__fixtures__/app/index.txt': 'app\n',
    'specs/api/__fixtures__/dead.json': '{}\n',
};

const deadInPool = (root: string): string[] =>
    ['dead.json', 'self', 'vouched.json'].map(
        (name) =>
            `${root}__fixtures__/${name}: the pool entry ${name}, which no spec under specs names — delete ${name}, or name it from the specs that share it`,
    );

const hole = (path: string): string => `\`${path.replace('#', ['$', '{x}'].join(''))}\``;

const DEAD_FOUND = [
    'specs/api/__fixtures__/dead.json: __fixtures__/dead.json, which no test of api names — delete __fixtures__/dead.json, or name it from the test that stands on it',
];

function findingsIn(files: Record<string, string>, under = ''): string[] {
    const root = packageWith(files);
    return checkNoUnusedGround(join(root, under)).map(
        ({ fix, found, line, path, rule }) =>
            `${path}: ${found} — ${fix}${line === 1 && rule === 'no-unused-ground' ? '' : ' (misfiled)'}`,
    );
}

describe('checkNoUnusedGround', () => {
    test.each([
        ['a fixture call', "api.fixture(directory('./__fixtures__/app/'));\n"],
        ['a path inside the entry', "const command = 'node ./__fixtures__/app/index.txt';\n"],
        [
            'a path from the project root',
            "const command = 'node specs/api/__fixtures__/app/index.txt';\n",
        ],
        ['a template without a hole', 'const app = `./__fixtures__/app`;\n'],
    ])('an entry named by %s is used, and its unnamed neighbour is not', (_, spec) => {
        // Given - a domain whose test names the app folder one way, beside a file nothing names
        // Then - only the file is dead
        expect(findingsIn({ ...DEAD, 'specs/api/users.spec.ts': spec })).toStrictEqual(DEAD_FOUND);
    });

    test.each([
        [
            'a spec document',
            'specs/api/users.spec.yaml',
            'description: reads the app\nfixture: ./__fixtures__/app/\nruns:\n    - command: echo\n      exit: 0\n',
        ],
        [
            'a module beside the tests',
            'specs/api/app.ts',
            "export const app = './__fixtures__/app';\n",
        ],
        [
            'a test the parser refuses',
            'specs/api/users.spec.ts',
            "const app = './__fixtures__/app'; const = ;\n",
        ],
        [
            'a test whose template text holds a quote',
            'specs/api/users.spec.ts',
            ['const q = `$', "{x}'`; const app = './__fixtures__/app';\n"].join(''),
        ],
    ])('an entry named by %s is used', (_, path, text) => {
        // Given - the app folder named from that file, a test standing beside it
        const files = {
            ...DEAD,
            'specs/api/other.spec.ts': "it('runs', () => {});\n",
            [path]: text,
        };

        // Then - only the file is dead
        expect(findingsIn(files)).toStrictEqual(DEAD_FOUND);
    });

    test('a template with a hole uses every entry its fixed ends match, in its folder alone', () => {
        // Given - fixtures and a seed read by name through templates, one of which fixes neither end
        const found = findingsIn({
            'specs/api/__fixtures__/a.json': '{}\n',
            'specs/api/__fixtures__/b.txt': '\n',
            'specs/api/__fixtures__/log-1.txt': '\n',
            'specs/api/__fixtures__/user-1.txt': '\n',
            'specs/api/__seeds__/c.json': '{}\n',
            'specs/api/users.spec.ts': `${['./__fixtures__/#.json', './__fixtures__/user-#', './__fixtures__/log-#.txt/lines', './__fixtures__/#', '#'].map(hole).join(';\n')};\n`,
        });

        // Then - the text file the user template misses and the seed are named by none
        expect(found).toStrictEqual([
            'specs/api/__fixtures__/b.txt: __fixtures__/b.txt, which no test of api names — delete __fixtures__/b.txt, or name it from the test that stands on it',
            'specs/api/__seeds__/c.json: __seeds__/c.json, which no test of api names — delete __seeds__/c.json, or name it from the test that stands on it',
        ]);
    });

    test('a literal that spells an entry name names nothing, nor a document quoting it outside its fixture', () => {
        // Given - a test spelling the dead file's name bare, and a document quoting its path in a stream
        const document =
            'description: prints\nfixture: ./__fixtures__/app/\nruns:\n    - command: echo\n      exit: 0\n      stdout: ./__fixtures__/dead.json\n';

        // Then - it is still dead
        expect(findingsIn({ ...DEAD, 'specs/api/users.spec.yaml': document })).toStrictEqual(
            DEAD_FOUND,
        );
        expect(
            findingsIn({
                ...DEAD,
                'specs/api/users.spec.ts':
                    "api.fixture(directory('./__fixtures__/app/')); log('dead.json');\n",
            }),
        ).toStrictEqual(DEAD_FOUND);
    });

    test('a domain holding ground and no test is named as a whole', () => {
        // Given - a domain with fixtures and seeds and no test
        const found = findingsIn({
            'specs/api/__fixtures__/a.json': '{}\n',
            'specs/api/__seeds__/b.sql': '\n',
        });

        // Then - the folder is named once, with what it holds
        expect(found).toStrictEqual([
            'specs/api: a domain folder holding __fixtures__, __seeds__ and no test or document — write the test that stands on __fixtures__, __seeds__, or delete the folder',
        ]);
    });

    test('the specs root, its setup and its pool are no domain, and a folder holding a test is no ground', () => {
        // Given - ground-named folders where no domain is (the specs root's, read by a spec) and a __fixtures__ folder holding a test
        const found = findingsIn({
            'specs/__fixtures__/a.json': '{}\n',
            'specs/__setup__/__fixtures__/b.json': '{}\n',
            'specs/api/__fixtures__/c.spec.ts': "it('runs', () => {});\n",
            'specs/api/users.spec.ts': "it('runs', () => { file('../__fixtures__/a.json'); });\n",
        });

        // Then - nothing is judged dead there
        expect(found).toStrictEqual([]);
    });

    test('a pool entry no spec outside the pool names is dead', () => {
        // Given - a pool entry a spec names, one only a pool file names, and one nothing names
        const files = {
            'specs/__fixtures__/app/index.txt': 'app\n',
            'specs/__fixtures__/dead.json': '{}\n',
            'specs/__fixtures__/self/x.spec.ts': "file('../vouched.json');\n",
            'specs/__fixtures__/vouched.json': '{}\n',
            'specs/api/users.spec.ts': "api.fixture(directory('../__fixtures__/app/'));\n",
        };

        // Then - the two unnamed by the specs are dead, named from the checked root
        expect([findingsIn(files), findingsIn(files, 'specs')]).toStrictEqual([
            deadInPool('specs/'),
            deadInPool(''),
        ]);
    });

    test('a dead pool entry is named once, as the pool’s, never again as the specs root’s ground', () => {
        // Given - a pool holding one entry a spec names and one nothing names
        const found = findingsIn({
            'specs/__expected__/dead.json': '{}\n',
            'specs/__expected__/read.json': '{}\n',
            'specs/api/users.spec.ts':
                "it('runs', () => { file('../__expected__/read.json'); });\n",
        });

        // Then - the one finding the pool owes
        expect(found).toStrictEqual([
            'specs/__expected__/dead.json: the pool entry dead.json, which no spec under specs names — delete dead.json, or name it from the specs that share it',
        ]);
    });
});
