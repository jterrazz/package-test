import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    isProductionModule,
    materialAt,
    reachOf,
    resolveSpecifier,
    specifiersIn,
    testPackageOf,
} from './production.js';
import { packageWith } from './rule-tester.fixtures.js';

const ROOT = packageWith({
    'package.json': JSON.stringify({ imports: { '#data/*': { default: './specs/fixtures/*' } } }),
    'src/contracts/engine.ts': 'export const engine = 1;\n',
    'src/domain/order.ts': 'export const order = 1;\n',
    'src/news/contracts/http/events.ts': 'export default {};\n',
    'src/news/contracts/news.contracts.ts': 'export const news = {};\n',
    'tools/a.ts': "import { b } from './b.js';\nexport { b };\n",
    'tools/b.ts': "import { a } from './a.js';\nexport { a };\n",
    'tsconfig.json': '{ "compilerOptions": { "baseUrl": "./src", "paths": { "@/*": ["*"] } } }',
});

describe('isProductionModule', () => {
    test.each([
        { path: 'src/domain/order.ts', production: true },
        { path: 'lint/rule.ts', production: true },
        { path: 'src/domain/order.test.ts', production: false },
        { path: 'src/domain/order.fixtures.ts', production: false },
        { path: 'src/domain/fixtures/app.ts', production: false },
        { path: 'src/news/contracts/http/events.ts', production: false },
        { path: 'scripts/seed.ts', production: true },
        { path: 'bin/cli.js', production: true },
        { path: 'index.ts', production: true },
        { path: 'specs/setup/seed.ts', production: false },
        { path: 'vitest.config.ts', production: false },
        { path: 'apps/web/vite.config.mts', production: false },
        { path: 'tests/helpers.ts', production: false },
        { path: 'src/__tests__/helpers.ts', production: false },
        { path: 'src/domain/order.json', production: false },
    ])('`$path` is production: $production', ({ path, production }) => {
        // Given - a module below the package root
        // Then - every source module is production, unless it is test material, a tool's config or under a retired test root
        expect(isProductionModule(join(ROOT, path))).toBe(production);
    });
});

describe('materialAt', () => {
    test.each([
        { kind: 'a test file', path: 'src/a.spec.ts' },
        { kind: 'a test file', path: 'src/a.test-d.ts' },
        { kind: 'a test file', path: 'specs/api/api.specification.ts' },
        { kind: 'the specs tree', path: 'specs/setup/seed.ts' },
        { kind: 'ground', path: 'src/requests/create.http' },
        { kind: 'a contract', path: 'src/news/contracts/http/events.ts' },
        { kind: undefined, path: 'src/contracts/engine.ts' },
    ])('`$path` is $kind', ({ kind, path }) => {
        // Given - a path of one kind
        // Then - the kind a message names it by
        expect(materialAt(join(ROOT, path))).toBe(kind);
    });

    test('reads a folder as a folder', () => {
        // Given - a path that ends on a ground folder
        // Then - as a file it is a module named `seeds`, as a folder it is ground
        expect(materialAt(join(ROOT, 'src/seeds'))).toBeUndefined();
        expect(materialAt(join(ROOT, 'src/seeds'), true)).toBe('ground');
    });
});

describe('testPackageOf', () => {
    test.each([
        { name: 'vitest', specifier: 'vitest/config' },
        { name: '@vitest/browser-playwright', specifier: '@vitest/browser-playwright' },
        { name: '@testing-library/react', specifier: '@testing-library/react' },
        { name: 'vitest-browser-react', specifier: 'vitest-browser-react' },
        { name: undefined, specifier: '@jterrazz/test/oxlint' },
        { name: undefined, specifier: 'vitesse' },
    ])('`$specifier` names $name', ({ name, specifier }) => {
        // Given - a specifier into a test package, or elsewhere
        // Then - the package, whatever subpath is written, and never the lint entry
        expect(testPackageOf(specifier)).toBe(name);
    });
});

describe('resolveSpecifier', () => {
    test('follows a relative path, a `paths` alias and an `imports` entry', () => {
        // Given - a module in the package
        const from = join(ROOT, 'src/domain/order.ts');

        // Then - the file on disk where there is one, else the path the specifier names
        expect(resolveSpecifier(from, './order.js')).toStrictEqual([from]);
        expect(resolveSpecifier(from, '@/domain/order')).toStrictEqual([from]);
        expect(resolveSpecifier(from, '#data/users.js')).toStrictEqual([
            join(ROOT, 'specs/fixtures/users.js'),
        ]);
    });

    test('names no local file for a package or a builtin', () => {
        // Given - a module in the package
        const from = join(ROOT, 'src/domain/order.ts');

        // Then - nothing: a package is judged by its name, never by a path
        expect([
            ...resolveSpecifier(from, 'node:fs'),
            ...resolveSpecifier(from, 'zod'),
        ]).toStrictEqual([]);
    });
});

describe('specifiersIn', () => {
    test('reads every form a module names another in, and never a comment', () => {
        // Given - one module using each form
        const text = [
            "import type { A } from './a.js';",
            "export * from './b.js';",
            "const c = await import('./c.js');",
            "const d = require('./d.js');",
            "const e = require.resolve('./e.js');",
            "// import { f } from './f.js';",
        ].join('\n');

        // Then - the five it names, and not the one a comment mentions
        expect(specifiersIn(text)).toStrictEqual([
            './a.js',
            './b.js',
            './c.js',
            './d.js',
            './e.js',
        ]);
    });
});

describe('reachOf', () => {
    test('ends on a cycle of modules that reach nothing', () => {
        // Given - two tool modules importing each other
        // Then - the walk visits each once and finds no material
        expect(reachOf(join(ROOT, 'src/domain/order.ts'), '../../tools/a.js')).toBeUndefined();
    });
});
