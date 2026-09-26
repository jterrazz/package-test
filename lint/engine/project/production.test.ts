import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../testing/package-tree.fixtures.js';
import {
    isProductionModule,
    lintBegins,
    materialAt,
    reachOf,
    resolveSpecifier,
    testPackageOf,
} from './production.js';

const ROOT = packageWith({
    'package.json': JSON.stringify({ imports: { '#data/*': { default: './specs/fixtures/*' } } }),
    'src/stubs/engine.ts': 'export const engine = 1;\n',
    'src/domain/order.ts': 'export const order = 1;\n',
    'src/news/stubs/http/events.ts': 'export default {};\n',
    'src/news/stubs/news.stubs.ts': 'export const news = {};\n',
    'tests/anchored.ts':
        "export const rows = new URL('../specs/fixtures/rows.json', import.meta.url);\n",
    'tests/named.ts': [
        "// import { users } from '../specs/fixtures/users.js';",
        'const note = "import { x } from \'../specs/fixtures/x.js\'";',
        'export { note };',
    ].join('\n'),
    'tests/read.ts':
        "import { readFileSync } from 'node:fs';\nexport const sql = readFileSync('./specs/seeds/a.sql');\n",
    'tests/typed.ts':
        "import type { Row } from '../specs/fixtures/row.js';\nexport type { Row };\n",
    'tools/a.ts': "import { b } from './b.js';\nexport { b };\n",
    'tools/b.ts': "import { a } from './a.js';\nexport { a };\n",
    'tsconfig.json': '{ "compilerOptions": { "baseUrl": "./src", "paths": { "@/*": ["*"] } } }',
});

const EXTENDED = packageWith({
    'apps/web/package.json': '{}',
    'apps/web/tsconfig.json': JSON.stringify({
        extends: ['@org/config/tsconfig', './tsconfig.app.json'],
    }),
    'apps/web/tsconfig.app.json': [
        '{',
        '    // The app config, itself built on the repository base.',
        '    "extends": "../../tsconfig.base",',
        '    "compilerOptions": { "baseUrl": "." },',
        '}',
    ].join('\n'),
    'node_modules/@org/config/tsconfig.json': JSON.stringify({
        compilerOptions: { paths: { '@shared/*': ['./shared/*'] } },
    }),
    'package.json': '{}',
    'tsconfig.base.json': JSON.stringify({
        compilerOptions: { paths: { '@data/*': ['specs/fixtures/*'] } },
        extends: './tsconfig.json',
    }),
    'tsconfig.json': JSON.stringify({ extends: './tsconfig.base.json' }),
});
function helperPackage(): { from: (name: string) => string; later: () => void } {
    const root = packageWith({ 'tests/helper.ts': 'export const helper = 1;\n' });
    return {
        from: (name) => join(root, 'src', name),
        later: () => {
            writeFileSync(
                join(root, 'tests/helper.ts'),
                "export { users } from '../specs/fixtures/users.js';\n",
            );
        },
    };
}
describe('production', () => {
    test.each([
        { path: 'src/domain/order.ts', production: true },
        { path: 'lint/rule.ts', production: true },
        { path: 'src/domain/order.test.ts', production: false },
        { path: 'src/domain/order.fixtures.ts', production: false },
        { path: 'src/domain/fixtures/app.ts', production: false },
        { path: 'src/news/stubs/http/events.ts', production: false },
        { path: 'scripts/seed.ts', production: true },
        { path: 'bin/cli.js', production: true },
        { path: 'index.ts', production: true },
        { path: 'specs/setup/seed.ts', production: false },
        { path: 'vitest.config.ts', production: false },
        { path: 'apps/web/vite.config.mts', production: false },
        { path: 'tests/helpers.ts', production: false },
        { path: 'src/__tests__/helpers.ts', production: false },
        { path: 'src/domain/order.json', production: false },
    ])('isProductionModule — `$path` is production: $production', ({ path, production }) => {
        // Given - a module below the package root
        // Then - every source module is production, unless it is test material, a tool's config or under a retired test root
        expect(isProductionModule(join(ROOT, path))).toBe(production);
    });

    test.each([
        { kind: 'a test file', path: 'src/a.spec.ts' },
        { kind: 'a test file', path: 'src/a.test-d.ts' },
        { kind: 'a test file', path: 'specs/api/api.specification.ts' },
        { kind: 'the specs tree', path: 'specs/setup/seed.ts' },
        { kind: 'ground', path: 'src/requests/create.http' },
        { kind: 'a stub', path: 'src/news/stubs/http/events.ts' },
        { kind: undefined, path: 'src/stubs/engine.ts' },
    ])('materialAt — `$path` is $kind', ({ kind, path }) => {
        // Given - a path of one kind
        // Then - the kind a message names it by
        expect(materialAt(join(ROOT, path))).toBe(kind);
    });

    test('materialAt — reads a folder as a folder', () => {
        // Given - a path that ends on a ground folder
        // Then - as a file it is a module named `seeds`, as a folder it is ground
        expect(materialAt(join(ROOT, 'src/seeds'))).toBeUndefined();
        expect(materialAt(join(ROOT, 'src/seeds'), true)).toBe('ground');
    });

    test.each([
        { name: 'vitest', specifier: 'vitest/config' },
        { name: '@vitest/browser-playwright', specifier: '@vitest/browser-playwright' },
        { name: '@testing-library/react', specifier: '@testing-library/react' },
        { name: 'vitest-browser-react', specifier: 'vitest-browser-react' },
        { name: undefined, specifier: '@jterrazz/test/oxlint' },
        { name: undefined, specifier: 'vitesse' },
    ])('testPackageOf — `$specifier` names $name', ({ name, specifier }) => {
        // Given - a specifier into a test package, or elsewhere
        // Then - the package, whatever subpath is written, and never the lint entry
        expect(testPackageOf(specifier)).toBe(name);
    });

    test('resolveSpecifier — follows `paths` through the `extends` chain, the last base winning, the baseUrl read where it is stated', () => {
        // Given - a module of the app, whose aliases come from two levels up the chain
        const from = join(EXTENDED, 'apps/web/src/page.ts');

        // Then - the repository base's alias, read from the app's own baseUrl; a cycle ends; the earlier base is overridden
        expect(resolveSpecifier(from, '@data/users.js')).toStrictEqual([
            join(EXTENDED, 'apps/web/specs/fixtures/users.js'),
        ]);
        expect(resolveSpecifier(from, '@shared/x.js')).toStrictEqual([]);
    });

    test('resolveSpecifier — reads a base config from a package when no relative one states the paths', () => {
        // Given - a module of an app extending only the package config
        const root = packageWith({
            'node_modules/@org/config/tsconfig.json': JSON.stringify({
                compilerOptions: { paths: { '@shared/*': ['./shared/*'] } },
            }),
            'package.json': '{}',
            'tsconfig.json': JSON.stringify({ extends: '@org/config/tsconfig' }),
        });

        // Then - the alias resolves beside the config that states it
        expect(resolveSpecifier(join(root, 'src/a.ts'), '@shared/x.js')).toStrictEqual([
            join(root, 'node_modules/@org/config/shared/x.js'),
        ]);
    });

    test('resolveSpecifier — follows a relative path, a `paths` alias and an `imports` entry', () => {
        // Given - a module in the package
        const from = join(ROOT, 'src/domain/order.ts');

        // Then - the file on disk where there is one, else the path the specifier names
        expect(resolveSpecifier(from, './order.js')).toStrictEqual([from]);
        expect(resolveSpecifier(from, '@/domain/order')).toStrictEqual([from]);
        expect(resolveSpecifier(from, '#data/users.js')).toStrictEqual([
            join(ROOT, 'specs/fixtures/users.js'),
        ]);
    });

    test('resolveSpecifier — names no local file for a package or a builtin', () => {
        // Given - a module in the package
        const from = join(ROOT, 'src/domain/order.ts');

        // Then - nothing: a package is judged by its name, never by a path
        expect([
            ...resolveSpecifier(from, 'node:fs'),
            ...resolveSpecifier(from, 'zod'),
        ]).toStrictEqual([]);
    });

    test.each([
        { module: 'anchored', what: 'specs/fixtures/rows.json' },
        { module: 'read', what: 'specs/seeds/a.sql' },
        { module: 'typed', what: 'specs/fixtures/row.js' },
    ])(
        'reachOf — sees what the non-production module `$module` names, parsed',
        ({ module, what }) => {
            // Given - production importing a module under a retired test root
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

    test('reachOf — ends on a cycle of modules that reach nothing', () => {
        // Given - two tool modules importing each other
        // Then - the walk visits each once and finds no material
        expect(reachOf(join(ROOT, 'src/domain/order.ts'), '../../tools/a.js')).toBeUndefined();
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
            /specs\/fixtures\/users\.js$/u,
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
