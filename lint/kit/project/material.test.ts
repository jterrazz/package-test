import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../testing/package-tree.fixtures.js';
import { isProductionModule, materialAt, testPackageOf } from './material.js';

const ROOT = packageWith({
    'app.stubs.ts': 'export const app = {};\n',
    'package.json': JSON.stringify({ imports: { '#data/*': { default: './specs/_fixtures/*' } } }),
    'src/stubs/engine.ts': 'export const engine = 1;\n',
    'src/domain/order.ts': 'export const order = 1;\n',
    'src/news/stubs/http/events.ts': 'export default {};\n',
    'src/news/stubs/news.stubs.ts': 'export const news = {};\n',
    'tests/anchored.ts':
        "export const rows = new URL('../specs/_fixtures/rows.json', import.meta.url);\n",
    'tests/named.ts': [
        "// import { users } from '../specs/_fixtures/users.js';",
        'const note = "import { x } from \'../specs/_fixtures/x.js\'";',
        'export { note };',
    ].join('\n'),
    'tests/read.ts':
        "import { readFileSync } from 'node:fs';\nexport const sql = readFileSync('./specs/_seeds/a.sql');\n",
    'tests/typed.ts':
        "import type { Row } from '../specs/_fixtures/row.js';\nexport type { Row };\n",
    'tools/a.ts': "import { b } from './b.js';\nexport { b };\n",
    'tools/b.ts': "import { a } from './a.js';\nexport { a };\n",
    'tsconfig.json': '{ "compilerOptions": { "baseUrl": "./src", "paths": { "@/*": ["*"] } } }',
});

describe('material', () => {
    test.each([
        { path: 'src/domain/order.ts', production: true },
        { path: 'lint/rule.ts', production: true },
        { path: 'src/domain/order.test.ts', production: false },
        { path: 'src/domain/order.fixtures.ts', production: false },
        { path: 'src/domain/_fixtures/app.ts', production: false },
        { path: 'src/news/stubs/http/events.ts', production: false },
        { path: 'scripts/seed.ts', production: true },
        { path: 'bin/cli.js', production: true },
        { path: 'index.ts', production: true },
        { path: 'specs/_shared/_setup/seed.ts', production: false },
        { path: 'vitest.config.ts', production: false },
        { path: 'apps/web/vite.config.mts', production: false },
        { path: 'tests/helpers.ts', production: false },
        { path: 'src/__tests__/helpers.ts', production: false },
        { path: 'src/domain/order.json', production: false },
    ])('isProductionModule — `$path` is production: $production', ({ path, production }) => {
        // Given - a module below the package root
        // Then - every source module is production, unless it is test material, a tool's config or under a separate test root
        expect(isProductionModule(join(ROOT, path))).toBe(production);
    });

    test.each([
        { kind: 'a test file', path: 'src/a.spec.ts' },
        { kind: 'a test file', path: 'src/a.test-d.ts' },
        { kind: 'a test file', path: 'specs/api/api.specification.ts' },
        { kind: 'the specs tree', path: 'specs/_shared/_setup/seed.ts' },
        { kind: 'ground', path: 'src/_requests/create.http' },
        { kind: 'a stub', path: 'src/news/stubs/http/events.ts' },
        { kind: 'a stub', path: 'src/news/stubs/news.stubs.ts' },
        { kind: undefined, path: 'src/stubs/engine.ts' },
    ])('materialAt — `$path` is $kind', ({ kind, path }) => {
        // Given - a path of one kind
        // Then - the kind a message names it by
        expect(materialAt(join(ROOT, path))).toBe(kind);
    });

    test('materialAt — reads a folder as a folder', () => {
        // Given - a path that ends on a ground folder
        // Then - as a file it is a module named `seeds`, as a folder it is ground
        expect(materialAt(join(ROOT, 'src/_seeds'))).toBeUndefined();
        expect(materialAt(join(ROOT, 'src/_seeds'), true)).toBe('ground');
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
});
