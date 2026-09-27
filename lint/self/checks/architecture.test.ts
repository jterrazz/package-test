import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { ROOT, treeOf } from '../../engine/testing/source.fixtures.js';
import { ARCHITECTURE } from './architecture.js';

const DEPCRUISE = join(ROOT, 'node_modules/.bin/depcruise');

type Violation = { from: string; rule: { name: string }; to: string };

/** Each import's target is written too, so dependency-cruiser resolves every edge as it resolves the package's own. */
function violationsIn(files: Record<string, string>): string[] {
    const tree = treeOf(files);
    try {
        for (const [from, text] of Object.entries(files)) {
            for (const { groups } of text.matchAll(/['"](?<target>\.{1,2}\/[^'"]+)['"]/gu)) {
                const path = join(
                    tree,
                    dirname(from),
                    (groups?.target ?? '').replace(/\.js$/u, '.ts'),
                );
                mkdirSync(dirname(path), { recursive: true });
                writeFileSync(path, 'export {};\n', { flag: 'a' });
            }
        }
        symlinkSync(join(ROOT, 'node_modules'), join(tree, 'node_modules'));
        writeFileSync(
            join(tree, 'depcruise.json'),
            JSON.stringify({
                forbidden: ARCHITECTURE.map(({ from, name, to }) => ({
                    from,
                    name,
                    to,
                })),
                options: { doNotFollow: { path: 'node_modules' }, tsPreCompilationDeps: true },
            }),
        );
        spawnSync(
            DEPCRUISE,
            [
                '--config',
                'depcruise.json',
                '--output-type',
                'json',
                '--output-to',
                'cruise.json',
                ...['src', 'lint'].filter((root) => existsSync(join(tree, root))),
            ],
            { cwd: tree, encoding: 'utf8' },
        );
        const { summary } = JSON.parse(readFileSync(join(tree, 'cruise.json'), 'utf8')) as {
            summary: { violations: Violation[] };
        };

        return summary.violations
            .map(
                ({ from, rule, to }) =>
                    `${from} → ${to.replace(/^.*node_modules\//u, 'node_modules/')}  ${rule.name}`,
            )
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
            'src/kernel/chain/perform.ts → node_modules/pg/lib/index.js  layer-src-kernel-chain-uses-its-declared-packages',
            'src/kernel/chain/perform.ts → node_modules/pg/lib/index.js  library-pg-has-one-owner',
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
            'src/facets/api/api.handle.ts → node_modules/playwright/index.js  layer-src-facets-api-uses-its-declared-packages',
            'src/facets/api/api.handle.ts → node_modules/playwright/index.js  library-playwright-has-one-owner',
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
});
