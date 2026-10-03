import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll } from 'vitest';

const REPOSITORY = resolve(import.meta.dirname, '../..');

/** The passes only this package runs on itself: `npm run build` first. */
export const { cleanup, lint } = await specification.lint({
    checkers: [`node ${REPOSITORY}/.artifacts/dev/self.js check`],
});

afterAll(cleanup);
