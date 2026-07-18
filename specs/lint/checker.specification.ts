import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

/**
 * E2E runner for the conventions checker (the non-oxlint static channel):
 * the binary wraps `dist/checker.js`, which walks a specs tree and rejects
 * unknown D4 tokens in fixture files (`requests/**`, `expected/**`).
 * Requires `npm run build` first (the checker runs from dist/).
 */
const CHECKER_BIN = resolve(import.meta.dirname, '../fixtures/checker-cli/check.sh');

export const { cleanup, cli } = await specification.cli(CHECKER_BIN);

afterAll(cleanup);
