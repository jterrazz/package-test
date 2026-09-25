import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';

import { VITEST_ARTIFACTS_DIR } from '../../kernel/files/artifacts.js';
import { writePendingRewrites } from './in-place.js';

/**
 * The global setup every preset project carries: update mode's rewrites of
 * the test files, written once the run is reported.
 *
 * It hands the project's workers a pending folder of its own — one per
 * project and per run, so two projects never write over each other's — and,
 * after the last test and the printed report, writes each source waiting
 * there over its test file.
 */

/**
 * Where a project finds this setup: this module in a source checkout,
 * `in-place-setup.js` in the built package, where the bundle and its entries
 * share one folder.
 */
export function inPlaceSetup(): string {
    const source = join(import.meta.dirname, 'in-place-setup.ts');
    return existsSync(source) ? source : join(import.meta.dirname, 'in-place-setup.js');
}

/** Where the pending folders of a run sit, below the project root. */
export const IN_PLACE_DIR = `${VITEST_ARTIFACTS_DIR}/in-place`;

export default function setup(project: TestProject): () => void {
    const folder = join(project.config.root, IN_PLACE_DIR, randomUUID());
    project.provide('inPlaceRewrites', folder);
    return () => {
        writePendingRewrites(folder);
    };
}
