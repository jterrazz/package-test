import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { VITEST_ARTIFACTS_DIR } from '../../../lint/kit/project/artifacts.js';
import { setupEntry } from '../../chain/paths/setup-entry.js';
import { writePendingRewrites } from './in-place.js';

export function inPlaceSetup(): string {
    return setupEntry(import.meta.dirname, 'in-place');
}

const IN_PLACE_DIR = `${VITEST_ARTIFACTS_DIR}/in-place`;

type RunProject = {
    config: { root: string };
    provide: (key: 'inPlaceRewrites', value: string) => void;
};

export default function setup(project: RunProject): () => void {
    const folder = join(project.config.root, IN_PLACE_DIR, randomUUID());
    project.provide('inPlaceRewrites', folder);
    return () => {
        writePendingRewrites(folder);
    };
}
