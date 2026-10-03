import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { ROOT, treeOf } from '../../kit/testing/source.fixtures.js';
import { ARCHITECTURE } from './architecture.js';

const CHECKER = join(ROOT, 'node_modules/@jterrazz/typescript/dist/checker.js');

const DEPCRUISE = join(ROOT, 'node_modules/.bin/depcruise');

type Row = { message: string; path: string; rule: string };

const isRow = (value: unknown): value is Row =>
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof value.message === 'string' &&
    'path' in value &&
    typeof value.path === 'string' &&
    'rule' in value &&
    typeof value.rule === 'string';

function writeTargets(tree: string, files: Record<string, string>): void {
    for (const [from, text] of Object.entries(files)) {
        for (const { groups } of text.matchAll(/['"](?<target>\.{1,2}\/[^'"]+)['"]/gu)) {
            const path = join(tree, dirname(from), (groups?.target ?? '').replace(/\.js$/u, '.ts'));
            mkdirSync(dirname(path), { recursive: true });
            writeFileSync(path, path.endsWith('.json') ? '{}\n' : 'export {};\n', {
                flag: path.endsWith('.json') ? 'w' : 'a',
            });
        }
    }
}

function violationsIn(files: Record<string, string>): string[] {
    const tree = treeOf(files);
    try {
        writeTargets(tree, files);
        symlinkSync(join(ROOT, 'node_modules'), join(tree, 'node_modules'));
        copyFileSync(join(ROOT, 'tsconfig.json'), join(tree, 'tsconfig.json'));
        writeFileSync(
            join(tree, 'jterrazz.config.ts'),
            `export default ${JSON.stringify({ typescript: { architecture: { layers: ARCHITECTURE } } })};\n`,
        );
        const { stdout } = spawnSync(
            process.execPath,
            [CHECKER, 'architecture', '.', '--depcruise', DEPCRUISE, '--format', 'json'],
            { cwd: tree, encoding: 'utf8' },
        );
        const parsed: unknown = JSON.parse(stdout);
        const rows: Row[] = Array.isArray(parsed)
            ? parsed.filter((row): row is Row => isRow(row))
            : [];

        return rows
            .map(({ message, path, rule }) => {
                const to = /imports `(?<to>[^`]+)`/u.exec(message)?.groups?.to ?? '';

                return `${path.replace(/:\d+:\d+$/u, '')} → ${to.replace(/^.*node_modules\//u, 'node_modules/')}  ${rule.replace(/^architecture\//u, '')}`;
            })
            .toSorted();
    } finally {
        rmSync(tree, { force: true, recursive: true });
    }
}

describe('ARCHITECTURE', () => {
    test('the layer map refuses a reverse edge and a package the layer does not declare, and passes its seams', () => {
        // Given - one reverse edge per layer, edges leaving both trees, and the seams the map grants
        const violations = violationsIn({
            'src/visitor/targets/roles.ts': "import '../../facets/website/website.face.js';\n",
            'src/expectations/result.ts': "import '../services/services.js';\n",
            'src/facets/api/api.project.ts': "import '../../vitest/project.js';\n",
            'src/facets/api/request/route.ts': "import '../../../vitest/project.js';\n",
            'src/facets/job/trigger.action.ts': "import '../../expectations/result.js';\n",
            'src/chain/chain.ts': "import '../clock/clock.js';\n",
            'src/chain/perform.ts': "import 'pg';\n",
            'src/disk/manifest.ts':
                "import manifest from '../../package.json' with { type: 'json' };\nexport default manifest;\n",
            'src/vitest/preset.ts': "import '../facets/cli/cli.project.js';\n",
            'src/vitest/reporter.ts':
                "import '../../specs/_shared/helper.js';\nimport '../../dist/index.js';\n",
            'src/clock/clock.ts': "import '../visitor/targets/roles.js';\n",
            'src/stubs/kinds/http-filter.ts': "import '../../expectations/tokens/match.js';\n",
            'src/stubs/kinds/openai.ts': "import '../../expectations/tokens/match.js';\n",
        });

        // Then - each reverse edge and each edge leaving both trees is named by the layer it leaves, and no seam is
        expect(violations).toStrictEqual([
            'src/chain/chain.ts → src/clock/clock.ts  layer-src-chain-imports-within-its-map',
            'src/chain/perform.ts → node_modules/pg/esm/index.mjs  layer-src-chain-uses-its-declared-packages',
            'src/chain/perform.ts → node_modules/pg/esm/index.mjs  library-pg-has-one-owner',
            'src/clock/clock.ts → src/visitor/targets/roles.ts  layer-src-clock-imports-within-its-map',
            'src/disk/manifest.ts → package.json  layer-src-disk-imports-within-its-map',
            'src/expectations/result.ts → src/services/services.ts  layer-expectations-result-ts-imports-within-its-map',
            'src/facets/api/request/route.ts → src/vitest/project.ts  layer-src-facets-api-imports-within-its-map',
            'src/stubs/kinds/openai.ts → src/expectations/tokens/match.ts  layer-src-stubs-imports-within-its-map',
            'src/visitor/targets/roles.ts → src/facets/website/website.face.ts  layer-src-visitor-imports-within-its-map',
            'src/vitest/preset.ts → src/facets/cli/cli.project.ts  facet-entered-by-its-face',
            'src/vitest/preset.ts → src/facets/cli/cli.project.ts  layer-src-vitest-imports-within-its-map',
            'src/vitest/reporter.ts → dist/index.ts  layer-src-vitest-imports-within-its-map',
            'src/vitest/reporter.ts → specs/_shared/helper.ts  layer-src-vitest-imports-within-its-map',
        ]);
    });

    test('a facet imports no other, is entered by its face, and each library has one owner', () => {
        // Given - a facet reaching another, entries skipping the face, and two libraries read outside their owner
        const violations = violationsIn({
            'src/facets/api/api.handle.ts':
                "import '../cli/cli.handle.js';\nexport const open = () => import('playwright');\n",
            'src/facets/cli/cli.project.ts': 'export {};\n',
            'src/index.ts':
                "import './facets/cli/cli.handle.js';\nimport './facets/cli/process/cli.port.js';\n",
            'src/index.vitest.ts':
                "import './facets/cli/cli.project.js';\nimport './facets/cli/cli.handle.js';\n",
            'src/services/postgres/postgres.adapter.ts': "import 'pg';\n",
        });

        // Then - each crossing is named, the runner-config entry reaching a project and the owner reaching its library pass
        expect(violations).toStrictEqual([
            'src/facets/api/api.handle.ts → node_modules/playwright/index.d.ts  layer-src-facets-api-uses-its-declared-packages',
            'src/facets/api/api.handle.ts → node_modules/playwright/index.d.ts  library-playwright-has-one-owner',
            'src/facets/api/api.handle.ts → src/facets/cli/cli.handle.ts  facet-imports-no-other-facet',
            'src/facets/api/api.handle.ts → src/facets/cli/cli.handle.ts  layer-src-facets-api-imports-within-its-map',
            'src/index.ts → src/facets/cli/cli.handle.ts  facet-entered-by-its-face',
            'src/index.ts → src/facets/cli/process/cli.port.ts  facet-entered-by-its-face',
            'src/index.vitest.ts → src/facets/cli/cli.handle.ts  facet-entered-by-its-face-from-src-index-vitest-ts',
        ]);
    });

    test('a spec reaches the framework by its published name, never by its source', () => {
        // Given - specs reaching an internal, the source entry, the published name, and their own app's source
        const violations = violationsIn({
            'specs/api/seed/seed.spec.ts': [
                "import '../../../src/clock/clock.js';",
                "import '../../../src/index.js';",
                "import '@jterrazz/test';",
                '',
            ].join('\n'),
            'specs/cli/run/run.test.ts':
                "import '../../../src/expectations/tokens/match.js';\nimport './app/main.js';\n",
        });

        // Then - the internal and the source entry are named at the spec; the published name and the app pass
        expect(violations).toStrictEqual([
            'specs/api/seed/seed.spec.ts → src/clock/clock.ts  no-framework-internals',
            'specs/api/seed/seed.spec.ts → src/index.ts  no-framework-internals',
            'specs/cli/run/run.test.ts → src/expectations/tokens/match.ts  no-framework-internals',
        ]);
    });

    test('a package is judged as the pass resolves it: a type-only import, a subpath and the package itself', () => {
        // Given - vitest/browser in and out of its owner, playwright's types in the chain, and the package's own name in a layer
        const violations = violationsIn({
            'src/facets/component/page/page.ts':
                "import { page } from 'vitest/browser';\nexport { page };\n",
            'src/index.browser.ts': 'export {};\n',
            'src/chain/browser.ts': "import { page } from 'vitest/browser';\nexport { page };\n",
            'src/chain/shot.ts':
                "import type { Browser } from 'playwright';\nexport type Shot = Browser;\n",
            'src/clock/self.ts': "import '@jterrazz/test';\n",
        });

        // Then - the subpath outside its owner, the type-only import and the self-reference are each named; the owner passes
        expect(violations).toStrictEqual([
            'src/chain/browser.ts → node_modules/vitest/browser/context.d.ts  layer-src-chain-uses-its-declared-packages',
            'src/chain/browser.ts → node_modules/vitest/browser/context.d.ts  library-vitest-browser-has-one-owner',
            'src/chain/shot.ts → node_modules/playwright/index.d.ts  layer-src-chain-uses-its-declared-packages',
            'src/chain/shot.ts → node_modules/playwright/index.d.ts  library-playwright-has-one-owner',
            'src/clock/self.ts → src/index.browser.ts  layer-src-clock-imports-within-its-map',
        ]);
    });
});
