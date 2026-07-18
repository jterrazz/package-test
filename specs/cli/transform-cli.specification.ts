import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

/**
 * CLI runner with an ANSI-stripping `transform` — the D6 escape hatch under
 * test in specs/cli/assertions. ANSI is already stripped by default before
 * stream comparisons; this runner exists to observe the transform MECHANISM
 * itself (raw `.text` untouched, fixture side never transformed, update mode
 * writing the post-normalisation form).
 */
const CLI_BIN = resolve(import.meta.dirname, '../fixtures/cli-app/cli.sh');

// eslint-disable-next-line no-control-regex
const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '');

export const { cleanup, cli } = await specification.cli(CLI_BIN, {
    transform: stripAnsi,
});

afterAll(cleanup);
