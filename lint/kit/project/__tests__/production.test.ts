import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import { allowedTestPackagesAt, lintBegins, reachOf } from '../production.js';

const ROOT = packageWith({
    'package.json': JSON.stringify({
        imports: { '#data/*': { default: './specs/__fixtures__/*' } },
    }),
    'src/stubs/engine.ts': 'export const engine = 1;\n',
    'src/domain/order.ts': 'export const order = 1;\n',
    'src/news/stubs/http/events.ts': 'export default {};\n',
    'src/news/stubs/news.stubs.ts': 'export const news = {};\n',
    'tests/anchored.ts':
        "export const rows = new URL('../specs/__fixtures__/rows.json', import.meta.url);\n",
    'tests/named.ts': [
        "// import { users } from '../specs/__fixtures__/users.js';",
        'const note = "import { x } from \'../specs/__fixtures__/x.js\'";',
        'export { note };',
    ].join('\n'),
    'tests/read.ts':
        "import { readFileSync } from 'node:fs';\nexport const sql = readFileSync('./specs/__seeds__/a.sql');\n",
    'tests/typed.ts':
        "import type { Row } from '../specs/__fixtures__/row.js';\nexport type { Row };\n",
    'tests/broken.ts': 'export const = ;\n',
    'tests/cycle-a.ts': "import { b } from './cycle-b.js';\nexport { b };\n",
    'tests/cycle-b.ts': "import { a } from './cycle-a.js';\nexport { a };\n",
    'tests/dynamic.ts': [
        'export const a = require(name);',
        "export const b = require.main('../specs/__fixtures__/a.js');",
        "export const c = path.resolve('../specs/__fixtures__/c.js');",
        '',
    ].join('\n'),
    'tests/mixed.ts':
        "import { readFileSync } from 'node:fs';\nreadFileSync('./README.md');\nexport { x } from '../specs/__fixtures__/x.js';\n",
    'tools/a.ts': "import { b } from './b.js';\nexport { b };\n",
    'tools/b.ts': "import { a } from './a.js';\nexport { a };\n",
    'tsconfig.json': '{ "compilerOptions": { "baseUrl": "./src", "paths": { "@/*": ["*"] } } }',
});

function helperPackage(): { from: (name: string) => string; later: () => void } {
    const root = packageWith({ 'tests/helper.ts': 'export const helper = 1;\n' });
    return {
        from: (name) => join(root, 'src', name),
        later: () => {
            writeFileSync(
                join(root, 'tests/helper.ts'),
                "export { users } from '../specs/__fixtures__/users.js';\n",
            );
        },
    };
}
describe('production', () => {
    test.each([
        { module: 'anchored', what: 'specs/__fixtures__/rows.json' },
        { module: 'read', what: 'specs/__seeds__/a.sql' },
        { module: 'typed', what: 'specs/__fixtures__/row.js' },
    ])(
        'reachOf — sees what the non-production module `$module` names, parsed',
        ({ module, what }) => {
            // Given - production importing a module under a separate test root
            const reach = reachOf(join(ROOT, 'src/domain/order.ts'), `../../tests/${module}.js`);

            // Then - the walk reads that module's program: a path it builds or reads, a type it imports
            expect(reach?.what).toBe(join(ROOT, what));
            expect(reach?.through).toStrictEqual([join(ROOT, 'tests', `${module}.ts`)]);
        },
    );

    test('reachOf — reads no reference in a comment or a string', () => {
        // Given - a module that only mentions a specifier, in prose and in a value
        // Then - nothing is reached
        expect(reachOf(join(ROOT, 'src/domain/order.ts'), '../../tests/named.js')).toBeUndefined();
    });

    test('reachOf — ends on a cycle of modules that reach nothing, a module it cannot parse, and calls that name no module', () => {
        // Given - tool modules and test modules importing each other, a module that does not parse, and one calling look-alikes of require
        const from = join(ROOT, 'src/domain/order.ts');

        // Then - the walk visits each once and finds no material
        expect(
            [
                '../../tools/a.js',
                '../../tests/cycle-a.js',
                '../../tests/broken.js',
                '../../tests/dynamic.js',
            ].map((specifier) => reachOf(from, specifier)),
        ).toStrictEqual([undefined, undefined, undefined, undefined]);
    });

    test('reachOf — a path that names no material does not end the walk before the import that does', () => {
        // Given - a module reading a README, then re-exporting a fixture
        // Then - the fixture is the reach
        expect(reachOf(join(ROOT, 'src/domain/order.ts'), '../../tests/mixed.js')?.what).toBe(
            join(ROOT, 'specs/__fixtures__/x.js'),
        );
    });

    test('reachOf — an alias with two targets is walked through the second when the first reaches nothing', () => {
        // Given - an alias whose first target is clean and whose second reaches a fixture
        const root = packageWith({
            'tests/a/h.ts': 'export const h = 1;\n',
            'tests/b/h.ts': "export { x } from '../../specs/__fixtures__/x.js';\n",
            'package.json': '{}',
            'src/m.ts': 'export {};\n',
            'tsconfig.json': JSON.stringify({
                compilerOptions: { paths: { '@x/*': ['./tests/a/*', './tests/b/*'] } },
            }),
        });

        // Then - the second target's fixture
        expect(reachOf(join(root, 'src/m.ts'), '@x/h.js')?.what).toBe(
            join(root, 'specs/__fixtures__/x.js'),
        );
    });

    test('reachOf — the test packages allowed are part of the question', () => {
        // Given - a production module importing the framework, asked without and with it allowed
        const from = join(ROOT, 'src/stubs/engine.ts');

        // Then - refused, then allowed, in one run
        expect([
            reachOf(from, '@jterrazz/test')?.kind,
            reachOf(from, '@jterrazz/test', new Set(['@jterrazz/test'])),
        ]).toStrictEqual(['a test package', undefined]);
    });

    test('allowedTestPackagesAt — names none for a file in no package, or in one that allows none', () => {
        // Given - a path outside every package, and a package with no settings
        // Then - nothing allowed
        expect([
            allowedTestPackagesAt('/nowhere/x.ts'),
            allowedTestPackagesAt(join(ROOT, 'src/x.ts')),
        ]).toStrictEqual([new Set(), new Set()]);
    });

    test('reachOf across a run — a specifier is walked once per folder: a module that changes after is not read again in the run', () => {
        // Given - a walk through the helper, the helper then reaching the specs tree
        const { from, later } = helperPackage();
        lintBegins(from('a.ts'));
        const before = reachOf(from('a.ts'), '../tests/helper.js');
        later();

        // Then - another module of the folder, linted for the first time, is answered from the run
        lintBegins(from('b.ts'));
        expect(before).toBeUndefined();
        expect(reachOf(from('b.ts'), '../tests/helper.js')).toBeUndefined();
    });

    test('reachOf across a run — a file linted a second time begins a new run', () => {
        // Given - the same walk, the helper changed, and the first file linted again
        const { from, later } = helperPackage();
        lintBegins(from('a.ts'));
        reachOf(from('a.ts'), '../tests/helper.js');
        later();
        lintBegins(from('a.ts'));

        // Then - the helper is read again
        expect(reachOf(from('a.ts'), '../tests/helper.js')?.through).toHaveLength(1);
    });

    test('reachOf across a run — a module a walk passed through, linted, begins a new run', () => {
        // Given - the same walk, then the helper itself linted after its change
        const { from, later } = helperPackage();
        lintBegins(from('a.ts'));
        reachOf(from('a.ts'), '../tests/helper.js');
        later();
        lintBegins(from('../tests/helper.ts'));

        // Then - the folder's next question is walked again
        expect(reachOf(from('b.ts'), '../tests/helper.js')?.what).toMatch(
            /specs\/__fixtures__\/users\.js$/u,
        );
    });

    test('reachOf across a run — a file created beside a folder already answered is seen by a sibling never linted before', () => {
        // Given - a folder answered about a sibling that did not exist yet
        const root = packageWith({ 'src/a.ts': 'export {};\n' });
        const from = (name: string): string => join(root, 'src', name);
        lintBegins(from('a.ts'));
        expect(reachOf(from('a.ts'), './x.test')).toBeUndefined();

        // When - that sibling is created, and never itself linted or walked
        writeFileSync(from('x.test.ts'), 'export const x = 1;\n');

        // Then - a module of the same folder, linted for the first time, sees it
        lintBegins(from('b.ts'));
        expect(reachOf(from('b.ts'), './x.test')?.kind).toBe('a test file');
    });
});
