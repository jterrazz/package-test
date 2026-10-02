import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

const REPOSITORY = resolve(import.meta.dirname, '../..');

/** The conventions checker as it ships: `npm run build` first. */
export const { cleanup, lint } = await specification.lint({
    checkers: [`node ${REPOSITORY}/dist/checker.js`],
});

afterAll(cleanup);
