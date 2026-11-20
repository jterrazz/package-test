import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { runMembers } from '../../../kit/checker/member-run.js';
import { CHECKER } from '../checker.js';
import {
    checkPixelGoldenWithinBudget,
    measurePixelGoldenWithinBudget,
    PIXEL_STANDARD,
    pixelGoldensUnder,
    pixelLimitsOf,
} from '../pixel-golden-within-budget.js';

type Tree = Record<string, number | string>;

function repository(tree: Tree): string {
    const root = mkdtempSync(join(tmpdir(), 'pixels-'));
    for (const [path, content] of Object.entries(tree)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(
            join(root, path),
            typeof content === 'number' ? Buffer.alloc(content) : content,
        );
    }
    return root;
}

const LIMITS = 'export default { test: { pixels: { budget: 300, cap: 100 } } };\n';

const foundOf = (root: string): string[] =>
    checkPixelGoldenWithinBudget(root).map((finding) => `${finding.path} ${finding.found}`);

describe('pixel-golden-within-budget', () => {
    test('the limits — a project lowers them, and one above the standard or of another shape reads as the standard', () => {
        // Given - no section, lowered limits, raised ones, and limits of other shapes
        const sections = [
            undefined,
            { pixels: { budget: 300, cap: 100 } },
            { pixels: { budget: 3_000_001, cap: 192_001 } },
            { pixels: { budget: '300', cap: 0 } },
            { pixels: { budget: -1, cap: 1.5 } },
            { pixels: 'small' },
        ];

        // Then - each section read as its limits
        expect(sections.map((section) => pixelLimitsOf(section))).toStrictEqual([
            PIXEL_STANDARD,
            { budget: 300, cap: 100 },
            PIXEL_STANDARD,
            PIXEL_STANDARD,
            PIXEL_STANDARD,
            PIXEL_STANDARD,
        ]);
    });

    test('the walk — every PNG under an __expected__/ at any depth, and none outside one, under __fixtures__/ or in an output folder', () => {
        // Given - PNGs in and out of the goldens' folder
        const root = repository({
            'app/__expected__/kit/panel.light.PNG': 3,
            'assets/icon.png': 9,
            'node_modules/x/__expected__/a.png': 9,
            'packages/ui/tests/__expected__/menu.light.png': 2,
            'packages/ui/tests/__expected__/menu.light.png.orig': 9,
            'specs/__fixtures__/project/__expected__/a.png': 9,
            'specs/__expected__/home.view.yaml': 'tree:\n',
        });

        // Then - the two goldens, by path
        expect(pixelGoldensUnder(root)).toStrictEqual([
            { bytes: 3, rel: 'app/__expected__/kit/panel.light.PNG' },
            { bytes: 2, rel: 'packages/ui/tests/__expected__/menu.light.png' },
        ]);
        expect(measurePixelGoldenWithinBudget(root)).toStrictEqual({ 'pixel-goldens/bytes': 5 });
    });

    test('a golden past its cap is refused at the image, and a total past the budget at the settings', () => {
        // Given - one image past the cap, the total past the budget
        const root = repository({
            '__expected__/a.png': 101,
            '__expected__/b.png': 100,
            '__expected__/c.png': 100,
            'studio.config.ts': LIMITS,
        });

        // Then - one finding each
        expect(foundOf(root)).toStrictEqual([
            '__expected__/a.png __expected__/a.png weighs 101 bytes, past the cap of 100 per image',
            'studio.config.ts 301 bytes of PNG under __expected__/, past the budget of 300',
        ]);
    });

    test('goldens within the cap and the budget, at its edge, pass', () => {
        // Given - two images at the cap, the total at the budget
        const root = repository({
            '__expected__/a.png': 100,
            '__expected__/b.png': 100,
            '__expected__/c.png': 100,
            'studio.config.ts': LIMITS,
        });

        // Then - nothing is reported
        expect(foundOf(root)).toStrictEqual([]);
    });

    test('a recorded total is held exactly: the tree above it grew, the tree below it left slack', () => {
        // Given - the same entry over a tree that grew, one that fell, and one that holds it
        const held = '{ "test": { "pixel-goldens/bytes": 150 } }\n';
        const roots = [160, 140, 150].map((bytes) =>
            repository({
                '.studio/baseline.json': held,
                '__expected__/a.png': bytes,
                'studio.config.ts':
                    'export default { test: { pixels: { budget: 300, cap: 200 } } };\n',
            }),
        );

        // Then - growth and slack at the entry, each naming its gesture, and the held tree passes
        expect(roots.map((root) => checkPixelGoldenWithinBudget(root))).toStrictEqual([
            [
                {
                    fix: "drop a golden no recipe needs, or crop it to its subject; a growth the review accepts is recorded by 'typescript baseline'",
                    found: '160 bytes of PNG under __expected__/, above the 150 .studio/baseline.json › test › pixel-goldens/bytes records',
                    line: 1,
                    path: '.studio/baseline.json',
                    rule: 'pixel-golden-within-budget',
                },
            ],
            [
                {
                    fix: "run 'typescript fix', which lowers the entry to 140",
                    found: '.studio/baseline.json › test › pixel-goldens/bytes records 150 bytes, and the tree holds 140',
                    line: 1,
                    path: '.studio/baseline.json',
                    rule: 'pixel-golden-within-budget',
                },
            ],
            [],
        ]);
    });

    test('a total past the budget is the budget finding, even above a recorded entry', () => {
        // Given - an entry under the budget, and a tree past both
        const root = repository({
            '.studio/baseline.json': '{ "test": { "pixel-goldens/bytes": 150 } }\n',
            '__expected__/a.png': 100,
            '__expected__/b.png': 100,
            '__expected__/c.png': 101,
            'studio.config.ts': 'export default { test: { pixels: { budget: 300, cap: 200 } } };\n',
        });

        // Then - the budget alone
        expect(foundOf(root)).toStrictEqual([
            'studio.config.ts 301 bytes of PNG under __expected__/, past the budget of 300',
        ]);
    });

    test('the run judges the budget once, at the project root, whatever member holds the images', () => {
        // Given - a workspace whose member holds an image past the cap
        const root = repository({
            'package.json': '{ "workspaces": ["packages/*"] }\n',
            'packages/ui/__expected__/a.png': 101,
            'packages/ui/package.json': '{ "name": "ui" }\n',
            'studio.config.ts': LIMITS,
        });

        // Then - one finding, from the root's run
        expect(
            runMembers(root, CHECKER)
                .filter((finding) => finding.rule === 'pixel-golden-within-budget')
                .map((finding) => finding.path),
        ).toStrictEqual(['packages/ui/__expected__/a.png']);
    });
});
