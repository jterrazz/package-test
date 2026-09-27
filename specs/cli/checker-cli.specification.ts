import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

const REPOSITORY = resolve(import.meta.dirname, '../..');

/** The conventions checker's own command line: `npm run build` first. A fixture's stub oxlint runs this repository's, named by `JTERRAZZ_TEST_REPO`. */
export const { cleanup, cli } = await specification.cli(`node ${REPOSITORY}/dist/checker.js`, {
    commands: ['baseline'],
    defaults: { JTERRAZZ_TEST_REPO: REPOSITORY },
});

afterAll(cleanup);
