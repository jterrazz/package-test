import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../testing/package-tree.fixtures.js';
import {
    argumentsAt,
    importedRunners,
    modelSpecFile,
    namedImports,
    runnerBindings,
    specificationModels,
} from '../spec-model.js';

const DATABASES = [
    'export const { api, cleanup, orchestrator: run } = await specification.api({',
    '    services: { db: postgres(), cache: redis(), other: sqlite({ file: "a" }) },',
    '});',
    '',
].join('\n');

const DOCKER = [
    "export const { cli: shell } = await specification.cli('bin', { docker: compose('./a.yml') });",
    "export const { cli: bare } = await specification.cli('bin', {});",
    '',
].join('\n');

describe('spec-model', () => {
    test('runnerBindings and argumentsAt — the runners a declaration binds and the arguments of a call', () => {
        // Given - declarations binding runners beside helpers, under their names or others, one inside a test's body
        const text = [
            'const { api, cleanup } = await specification.api({});',
            'const { cli: run, docker } = await specification.cli(bin);',
            "test('a', async () => { const { api: bare, cleanup: stop } = await specification.api({}); });",
            'const { page } = await specification.website({});',
            'call(a, (b), c',
        ].join('\n');

        // Then - each runner and the name it is read by, and the arguments of a call, closed or not
        expect([
            runnerBindings(text),
            argumentsAt('f(a, (b), c) + 1', 1),
            argumentsAt(text, text.lastIndexOf('call(') + 4),
        ]).toStrictEqual([
            [
                { key: 'api', local: 'api' },
                { key: 'cli', local: 'run' },
                { key: 'api', local: 'bare' },
            ],
            'a, (b), c',
            'a, (b), c',
        ]);
    });

    test('modelSpecFile — the runners a specification exports, whether it runs docker, and how many SQL databases it declares', () => {
        // Given - specification files of each shape
        const root = packageWith({
            'a.specification.ts': DATABASES,
            'b.specification.ts': DOCKER,
            'c.specification.ts':
                'export const { api } = await specification.api({ services: SERVICES });\n',
            'd.specification.ts':
                'export const { api } = await specification.api({ services: { db: env.DB } });\n',
            'e.specification.ts':
                'export const { api } = await specification.api({ services: { db: postgres(',
            'f.specification.ts':
                'export const { api } = await specification.api({ services: {} });\n',
            'g.specification.ts':
                "export const { cli } = await specification.cli('bin', {});\nconst other = { docker: true };\n",
            'h.specification.ts':
                'export const { api } = await specification.api({ services: { nested: { inner: postgres() } } });\n',
        });

        // Then - each model
        expect(
            ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((name) => {
                const { dockerAware, runnerExports, sqlDatabaseCount } = modelSpecFile(
                    join(root, `${name}.specification.ts`),
                );
                return [[...runnerExports], dockerAware, sqlDatabaseCount];
            }),
        ).toStrictEqual([
            [['api'], false, 2],
            [['shell', 'bare'], true, null],
            [['api'], false, null],
            [['api'], false, null],
            [['api'], false, null],
            [['api'], false, 0],
            [['cli'], false, null],
            [['api'], false, null],
        ]);
    });

    test('namedImports — each binding of a braced import, renamed or not, type imports included', () => {
        // Given - imports of each spelling
        const text = [
            "import { api, cli as run } from '../api.specification.js';",
            "import type { Shape } from './shape.js';",
            "import {\n    first,\n} from 'pkg';",
            "import whole from 'whole';",
        ].join('\n');

        // Then - every braced binding with its source
        expect(namedImports(text)).toStrictEqual([
            { local: 'api', name: 'api', source: '../api.specification.js' },
            { local: 'run', name: 'cli', source: '../api.specification.js' },
            { local: 'Shape', name: 'Shape', source: './shape.js' },
            { local: 'first', name: 'first', source: 'pkg' },
        ]);
    });

    test('specificationModels and importedRunners — the kept specifications, and the runners a test imports from them by any spelling', () => {
        // Given - a docker specification, one that runs none, one exporting no runner, and a test importing from each
        const root = packageWith({
            'specs/cli/bare.specification.ts':
                "export const { cli } = await specification.cli('bin', {});\n",
            'specs/cli/cli.specification.ts': DOCKER,
            'specs/cli/empty.specification.ts': 'export const helper = 1;\n',
            'specs/cli/helper.ts': DOCKER,
            'specs/cli/loose.specification.ts':
                "const handle = await specification.cli('bin', { docker: x });\n",
        });
        const models = specificationModels(root, ({ dockerAware }) => dockerAware);
        const reader = join(root, 'specs/cli/build.test.ts');
        const text = [
            "import { shell as one } from './cli.specification.js';",
            "import { shell as two } from './cli.specification';",
            "import { shell as three } from './cli.specification.ts';",
            "import { other } from './cli.specification.js';",
            "import { cli as four } from './bare.specification.js';",
            "import { shell as five } from 'cli.specification';",
        ].join('\n');

        // Then - the one docker specification, and the three imports of its runner
        expect([
            [...models.keys()].map((file) => file.slice(root.length + 1)),
            importedRunners(reader, text, models).map(
                ({ local, model }) => `${local} ${model.file.slice(root.length + 1)}`,
            ),
        ]).toStrictEqual([
            ['specs/cli/cli.specification.ts'],
            [
                'one specs/cli/cli.specification.ts',
                'two specs/cli/cli.specification.ts',
                'three specs/cli/cli.specification.ts',
            ],
        ]);
    });
});
