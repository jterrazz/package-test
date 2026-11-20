import {
    GROUND_EXPECTED,
    GROUND_FIXTURES,
    readSettingsSync,
    treeEntries,
} from '@jterrazz/typescript/rules';
import { statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { heldPixelBytes, PIXELS_KEY, PIXELS_LEDGER } from '../../kit/baseline/test-baseline.js';
import { recordAt } from '../../kit/project/json-shape.js';
import { PRUNED_WITH_OUTPUTS } from '../../kit/project/module-tests.js';
import { SETTINGS_FILE } from '../../kit/project/settings-file.js';
import { TEST_SECTION } from '../../kit/project/test-section.js';
import type { Spotted } from './checker.js';

export const PIXEL_STANDARD = { budget: 3_000_000, cap: 192_000 } as const;

const BASELINE_FILE = '.studio/baseline.json';

const PNG = /\.png$/iu;

export type PixelGolden = { bytes: number; rel: string };

const isWhole = (value: unknown): value is number => Number.isInteger(value);

const limitOf = (value: unknown, standard: number): number =>
    isWhole(value) && value > 0 ? Math.min(value, standard) : standard;

/** A limit above the standard's, or of another shape, reads as the standard's: a project tightens the standard, never loosens it. */
export function pixelLimitsOf(test: unknown): { budget: number; cap: number } {
    const pixels = recordAt(test, 'pixels');
    return {
        budget: limitOf(pixels.budget, PIXEL_STANDARD.budget),
        cap: limitOf(pixels.cap, PIXEL_STANDARD.cap),
    };
}

/** Every PNG under an `__expected__/` the root holds, members included; a `__fixtures__/` tree is verbatim material, and is not entered. */
export function pixelGoldensUnder(rootDir: string): PixelGolden[] {
    const found: PixelGolden[] = [];
    const walk = (dir: string, expected: boolean): void => {
        for (const entry of treeEntries(dir)) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!PRUNED_WITH_OUTPUTS.has(entry.name) && entry.name !== GROUND_FIXTURES) {
                    walk(path, expected || entry.name === GROUND_EXPECTED);
                }
            } else if (expected && PNG.test(entry.name)) {
                found.push({ bytes: statSync(path).size, rel: relative(rootDir, path) });
            }
        }
    };
    walk(rootDir, false);
    return found.toSorted((left, right) => left.rel.localeCompare(right.rel));
}

const bytesOf = (goldens: readonly PixelGolden[]): number =>
    goldens.reduce((sum, golden) => sum + golden.bytes, 0);

function budgetFindings(total: number, budget: number, held: number | undefined): Spotted[] {
    if (held !== undefined && total < held) {
        return [
            {
                fix: `run 'typescript fix', which lowers the entry to ${String(total)}`,
                found: `${PIXELS_LEDGER} records ${String(held)} bytes, and the tree holds ${String(total)}`,
                line: 1,
                path: BASELINE_FILE,
                rule: 'pixel-golden-within-budget',
            },
        ];
    }
    if (total > budget) {
        return [
            {
                fix: 'keep the goldens a paint recipe needs, each cropped to its subject, and state the rest as view goldens',
                found: `${String(total)} bytes of PNG under ${GROUND_EXPECTED}/, past the budget of ${String(budget)}`,
                line: 1,
                path: SETTINGS_FILE,
                rule: 'pixel-golden-within-budget',
            },
        ];
    }
    return held !== undefined && total > held
        ? [
              {
                  fix: "drop a golden no recipe needs, or crop it to its subject; a growth the review accepts is recorded by 'typescript baseline'",
                  found: `${String(total)} bytes of PNG under ${GROUND_EXPECTED}/, above the ${String(held)} ${PIXELS_LEDGER} records`,
                  line: 1,
                  path: BASELINE_FILE,
                  rule: 'pixel-golden-within-budget',
              },
          ]
        : [];
}

/** Judged once, by the run over the project root: the budget is the repository's, whatever member holds the images. */
export function checkPixelGoldenWithinBudget(rootDir: string): Spotted[] {
    const { budget, cap } = pixelLimitsOf(
        readSettingsSync(rootDir).resolved.sections[TEST_SECTION],
    );
    const goldens = pixelGoldensUnder(rootDir);
    const total = bytesOf(goldens);
    return [
        ...goldens
            .filter((golden) => golden.bytes > cap)
            .map((golden) => ({
                fix: 'crop it to its subject and its shadow, re-encode it with the pinned lossless encoder, or let its view golden prove it',
                found: `${golden.rel} weighs ${String(golden.bytes)} bytes, past the cap of ${String(cap)} per image`,
                line: 1,
                path: golden.rel,
                rule: 'pixel-golden-within-budget' as const,
            })),
        ...budgetFindings(total, budget, heldPixelBytes(rootDir)),
    ];
}

export const measurePixelGoldenWithinBudget = (rootDir: string): Record<string, number> => ({
    [PIXELS_KEY]: bytesOf(pixelGoldensUnder(rootDir)),
});
