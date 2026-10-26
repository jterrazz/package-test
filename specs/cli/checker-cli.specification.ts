import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

const REPOSITORY = resolve(import.meta.dirname, '../..');

const CONVENTIONS = `node ${REPOSITORY}/node_modules/@jterrazz/typescript/dist/checker.js --preset ${REPOSITORY}/dist/checker.js`;

/** The conventions checks as the toolchain runs them, through its checker program: `npm run build` first. A fixture's stub oxlint runs this repository's, named by `STUDIO_TEST_REPO`. */
export const { cleanup, cli } = await specification.cli(CONVENTIONS, {
    commands: ['baseline'],
    defaults: { STUDIO_TEST_REPO: REPOSITORY },
});

afterAll(cleanup);
