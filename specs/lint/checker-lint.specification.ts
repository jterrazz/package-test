import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

const REPOSITORY = resolve(import.meta.dirname, '../..');

/** The conventions checks as they ship, run by the toolchain's checker program: `npm run build` first. */
export const { cleanup, lint } = await specification.lint({
    checkers: [
        `node ${REPOSITORY}/node_modules/@jterrazz/typescript/dist/checker.js --preset ${REPOSITORY}/dist/checker.js`,
    ],
});

afterAll(cleanup);
