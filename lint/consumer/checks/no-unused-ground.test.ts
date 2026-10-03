import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../kit/testing/package-tree.fixtures.js';
import { checkNoUnusedGround } from './no-unused-ground.js';

const DEAD = {
    'specs/api/_fixtures/app/index.txt': 'app\n',
    'specs/api/_fixtures/dead.json': '{}\n',
};

const deadInPool = (root: string): string[] =>
    ['dead.json', 'self', 'vouched.json'].map(
        (name) =>
            `${root}_shared/_fixtures/${name}: the pool entry ${name}, which no spec under specs names — delete ${name}, or name it from the specs that share it`,
    );

const hole = (path: string): string => `\`${path.replace('#', ['$', '{x}'].join(''))}\``;

const DEAD_FOUND = [
    'specs/api/_fixtures/dead.json: _fixtures/dead.json, which no test of api names — delete _fixtures/dead.json, or name it from the test that stands on it',
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
        ['a fixture call', "api.fixture(directory('./_fixtures/app/'));\n"],
        ['a path inside the entry', "const command = 'node ./_fixtures/app/index.txt';\n"],
        [
            'a path from the project root',
            "const command = 'node specs/api/_fixtures/app/index.txt';\n",
        ],
        ['a template without a hole', 'const app = `./_fixtures/app`;\n'],
    ])('an entry named by %s is used, and its unnamed neighbour is not', (_, spec) => {
        // Given - a domain whose test names the app folder one way, beside a file nothing names
        // Then - only the file is dead
        expect(findingsIn({ ...DEAD, 'specs/api/users.spec.ts': spec })).toStrictEqual(DEAD_FOUND);
    });

    test.each([
        [
            'a spec document',
            'specs/api/users.spec.yaml',
            'description: reads the app\nfixture: ./_fixtures/app/\nruns:\n    - command: echo\n      exit: 0\n',
        ],
        [
            'a module beside the tests',
            'specs/api/app.ts',
            "export const app = './_fixtures/app';\n",
        ],
        [
            'a test the parser refuses',
            'specs/api/users.spec.ts',
            "const app = './_fixtures/app'; const = ;\n",
        ],
        [
            'a test whose template text holds a quote',
            'specs/api/users.spec.ts',
            ['const q = `$', "{x}'`; const app = './_fixtures/app';\n"].join(''),
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
            'specs/api/_fixtures/a.json': '{}\n',
            'specs/api/_fixtures/b.txt': '\n',
            'specs/api/_fixtures/log-1.txt': '\n',
            'specs/api/_fixtures/user-1.txt': '\n',
            'specs/api/_seeds/c.json': '{}\n',
            'specs/api/users.spec.ts': `${['./_fixtures/#.json', './_fixtures/user-#', './_fixtures/log-#.txt/lines', './_fixtures/#', '#'].map(hole).join(';\n')};\n`,
        });

        // Then - the text file the user template misses and the seed are named by none
        expect(found).toStrictEqual([
            'specs/api/_fixtures/b.txt: _fixtures/b.txt, which no test of api names — delete _fixtures/b.txt, or name it from the test that stands on it',
            'specs/api/_seeds/c.json: _seeds/c.json, which no test of api names — delete _seeds/c.json, or name it from the test that stands on it',
        ]);
    });

    test('a literal that spells an entry name names nothing, nor a document quoting it outside its fixture', () => {
        // Given - a test spelling the dead file's name bare, and a document quoting its path in a stream
        const document =
            'description: prints\nfixture: ./_fixtures/app/\nruns:\n    - command: echo\n      exit: 0\n      stdout: ./_fixtures/dead.json\n';

        // Then - it is still dead
        expect(findingsIn({ ...DEAD, 'specs/api/users.spec.yaml': document })).toStrictEqual(
            DEAD_FOUND,
        );
        expect(
            findingsIn({
                ...DEAD,
                'specs/api/users.spec.ts':
                    "api.fixture(directory('./_fixtures/app/')); log('dead.json');\n",
            }),
        ).toStrictEqual(DEAD_FOUND);
    });

    test('a domain holding ground and no test is named as a whole', () => {
        // Given - a domain with fixtures and seeds and no test
        const found = findingsIn({
            'specs/api/_fixtures/a.json': '{}\n',
            'specs/api/_seeds/b.sql': '\n',
        });

        // Then - the folder is named once, with what it holds
        expect(found).toStrictEqual([
            'specs/api: a domain folder holding _fixtures, _seeds and no test or document — write the test that stands on _fixtures, _seeds, or delete the folder',
        ]);
    });

    test('the specs root, its setup and its pool are no domain, and a folder holding a test is no ground', () => {
        // Given - ground-named folders where no domain is, and a _fixtures folder holding a test
        const found = findingsIn({
            'specs/_fixtures/a.json': '{}\n',
            'specs/_setup/_fixtures/b.json': '{}\n',
            'specs/api/_fixtures/c.spec.ts': "it('runs', () => {});\n",
            'specs/api/users.spec.ts': "it('runs', () => {});\n",
        });

        // Then - nothing is judged dead there
        expect(found).toStrictEqual([]);
    });

    test('a pool entry no spec outside the pool names is dead', () => {
        // Given - a pool entry a spec names, one only a pool file names, and one nothing names
        const files = {
            'specs/_shared/_fixtures/app/index.txt': 'app\n',
            'specs/_shared/_fixtures/dead.json': '{}\n',
            'specs/_shared/_fixtures/self/x.spec.ts': "file('../vouched.json');\n",
            'specs/_shared/_fixtures/vouched.json': '{}\n',
            'specs/api/users.spec.ts': "api.fixture(directory('../_shared/_fixtures/app/'));\n",
        };

        // Then - the two unnamed by the specs are dead, named from the checked root
        expect([findingsIn(files), findingsIn(files, 'specs')]).toStrictEqual([
            deadInPool('specs/'),
            deadInPool(''),
        ]);
    });
});
