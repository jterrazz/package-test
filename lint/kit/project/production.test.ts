import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../testing/package-tree.fixtures.js';
import { lintBegins, reachOf } from './production.js';

const ROOT = packageWith({
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

function helperPackage(): { from: (name: string) => string; later: () => void } {
    const root = packageWith({ 'tests/helper.ts': 'export const helper = 1;\n' });
    return {
        from: (name) => join(root, 'src', name),
        later: () => {
            writeFileSync(
                join(root, 'tests/helper.ts'),
                "export { users } from '../specs/_fixtures/users.js';\n",
            );
        },
    };
}
describe('production', () => {
    test.each([
        { module: 'anchored', what: 'specs/_fixtures/rows.json' },
        { module: 'read', what: 'specs/_seeds/a.sql' },
        { module: 'typed', what: 'specs/_fixtures/row.js' },
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
            /specs\/_fixtures\/users\.js$/u,
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
