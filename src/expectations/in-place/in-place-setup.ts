import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';

import { VITEST_ARTIFACTS_DIR } from '../../../lint/engine/project/artifacts.js';
import { setupEntry } from '../../chain/paths/setup-entry.js';
import { writePendingRewrites } from './in-place.js';

export function inPlaceSetup(): string {
    return setupEntry(import.meta.dirname, 'in-place-setup.ts', 'in-place-setup.js');
}

export const IN_PLACE_DIR = `${VITEST_ARTIFACTS_DIR}/in-place`;

export default function setup(project: TestProject): () => void {
    const folder = join(project.config.root, IN_PLACE_DIR, randomUUID());
    project.provide('inPlaceRewrites', folder);
    return () => {
        writePendingRewrites(folder);
    };
}
