import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { ROOT, treeOf } from '../../engine/testing/source.fixtures.js';
import { ARCHITECTURE } from './architecture.js';

const CHECKER = join(ROOT, 'node_modules/@jterrazz/typescript/dist/checker.js');

const DEPCRUISE = join(ROOT, 'node_modules/.bin/depcruise');

type Diagnostic = { code: string; filename: string; message: string };

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
        const { diagnostics } = JSON.parse(stdout) as { diagnostics: Diagnostic[] };

        return diagnostics
            .map(({ code, filename, message }) => {
                const to = /imports `(?<to>[^`]+)`/u.exec(message)?.groups?.to ?? '';

                return `${filename.replace(/:\d+:\d+$/u, '')} → ${to.replace(/^.*node_modules\//u, 'node_modules/')}  ${code.replace(/^architecture\((?<rule>.+)\)$/u, '$<rule>')}`;
            })
            .toSorted();
    } finally {
        rmSync(tree, { force: true, recursive: true });
    }
}

describe('ARCHITECTURE', () => {
    test('the layer map refuses a reverse edge and a package the layer does not declare, and passes its seams', () => {
        // Given - one reverse edge per layer, and the seams the map grants
        const violations = violationsIn({
            'src/elements/descriptors/roles.ts': "import '../../facets/website/index.js';\n",
            'src/expectations/result.ts': "import '../world/services/services.js';\n",
            'src/facets/api/api.project.ts': "import '../../vitest/project.js';\n",
            'src/facets/api/request/route.ts': "import '../../../vitest/project.js';\n",
            'src/facets/job/trigger.action.ts': "import '../../expectations/result.js';\n",
            'src/kernel/chain/chain.ts': "import '../../world/clock/clock.js';\n",
            'src/kernel/chain/perform.ts': "import 'pg';\n",
            'src/vitest/preset.ts': "import '../facets/cli/cli.project.js';\n",
            'src/world/clock/clock.ts': "import '../../elements/descriptors/roles.js';\n",
            'src/world/stubs/kinds/http.ts': "import '../../../expectations/tokens/match.js';\n",
            'src/world/stubs/kinds/openai.ts': "import '../../../expectations/tokens/match.js';\n",
        });

        // Then - each reverse edge is named by the layer it leaves, and no seam is
        expect(violations).toStrictEqual([
            'src/elements/descriptors/roles.ts → src/facets/website/index.ts  layer-src-elements-imports-within-its-map',
            'src/expectations/result.ts → src/world/services/services.ts  layer-src-expectations-imports-within-its-map',
            'src/facets/api/request/route.ts → src/vitest/project.ts  layer-src-facets-api-imports-within-its-map',
            'src/kernel/chain/chain.ts → src/world/clock/clock.ts  layer-src-kernel-chain-imports-within-its-map',
            'src/kernel/chain/perform.ts → node_modules/pg/esm/index.mjs  layer-src-kernel-chain-uses-its-declared-packages',
            'src/kernel/chain/perform.ts → node_modules/pg/esm/index.mjs  library-pg-has-one-owner',
            'src/vitest/preset.ts → src/facets/cli/cli.project.ts  facet-entered-by-its-face',
            'src/vitest/preset.ts → src/facets/cli/cli.project.ts  layer-src-vitest-imports-within-its-map',
            'src/world/clock/clock.ts → src/elements/descriptors/roles.ts  layer-src-world-clock-imports-within-its-map',
            'src/world/stubs/kinds/openai.ts → src/expectations/tokens/match.ts  layer-src-world-stubs-imports-within-its-map',
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
            'src/world/services/postgres/postgres.adapter.ts': "import 'pg';\n",
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

    test('lint/ imports in one direction, and the product reads the engine and the indexes alone', () => {
        // Given - the engine reaching a rule, folders reaching sideways and upward, the entry reaching self, the product reaching a rule
        const violations = violationsIn({
            'lint/consumer/catalogue/manifest.ts': "import '../rules/plugin.js';\n",
            'lint/consumer/checks/tree.ts': "import '../../self/checks/checker.js';\n",
            'lint/consumer/rules/chain/no-sleep.ts':
                "import '../../catalogue/manifest.js';\nimport '../../checks/checker.js';\n",
            'lint/engine/project/role.ts': "import '../../consumer/rules/plugin.js';\n",
            'lint/index.ts':
                "import './consumer/rules/plugin.js';\nimport './self/rules/plugin.js';\n",
            'src/kernel/files/scratch.ts': [
                "import '../../../lint/engine/project/ground.js';",
                "import '../../../lint/consumer/rules/world/no-sleep.js';",
                "import '../../../lint/index.refusal.js';",
                '',
            ].join('\n'),
        });

        // Then - each edge against the direction is named by the folder it leaves
        expect(violations).toStrictEqual([
            'lint/consumer/catalogue/manifest.ts → lint/consumer/rules/plugin.ts  lint-direction-consumer-catalogue',
            'lint/consumer/checks/tree.ts → lint/self/checks/checker.ts  lint-direction-consumer-checks',
            'lint/consumer/rules/chain/no-sleep.ts → lint/consumer/checks/checker.ts  lint-direction-consumer-rules',
            'lint/engine/project/role.ts → lint/consumer/rules/plugin.ts  lint-direction-engine',
            'lint/index.ts → lint/self/rules/plugin.ts  lint-direction-index',
            'src/kernel/files/scratch.ts → lint/consumer/rules/world/no-sleep.ts  layer-src-kernel-files-imports-within-its-map',
            'src/kernel/files/scratch.ts → lint/consumer/rules/world/no-sleep.ts  lint-direction-src',
        ]);
    });

    test('a package is judged as the pass resolves it: a type-only import, a subpath and the package itself', () => {
        // Given - vitest/browser in and out of its owner, playwright's types in the kernel, and the package's own name in a layer
        const violations = violationsIn({
            'src/facets/component/page/page.ts':
                "import { page } from 'vitest/browser';\nexport { page };\n",
            'src/index.browser.ts': 'export {};\n',
            'src/kernel/chain/browser.ts':
                "import { page } from 'vitest/browser';\nexport { page };\n",
            'src/kernel/chain/shot.ts':
                "import type { Browser } from 'playwright';\nexport type Shot = Browser;\n",
            'src/world/clock/self.ts': "import '@jterrazz/test';\n",
        });

        // Then - the subpath outside its owner, the type-only import and the self-reference are each named; the owner passes
        expect(violations).toStrictEqual([
            'src/kernel/chain/browser.ts → node_modules/vitest/browser/context.d.ts  layer-src-kernel-chain-uses-its-declared-packages',
            'src/kernel/chain/browser.ts → node_modules/vitest/browser/context.d.ts  library-vitest-browser-has-one-owner',
            'src/kernel/chain/shot.ts → node_modules/playwright/index.d.ts  layer-src-kernel-chain-uses-its-declared-packages',
            'src/kernel/chain/shot.ts → node_modules/playwright/index.d.ts  library-playwright-has-one-owner',
            'src/world/clock/self.ts → src/index.browser.ts  layer-src-world-clock-imports-within-its-map',
        ]);
    });
});
