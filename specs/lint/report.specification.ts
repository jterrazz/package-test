import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { lintReport, specification } from '../../src/index.js';

/**
 * The runner every lint rule's `<case>.spec.yaml` is bound to (the `literate()`
 * plugin of the `unit` project names it): a tree in, the command, the report
 * out, normalised by the package's own `lintReport` — the transform every rule
 * spec of the family shares, so a golden proves where a rule fired and which
 * one it was, never how its message is worded.
 *
 * Requires `npm run build` first: the wrapper runs `dist/oxlint.js` and
 * `dist/checker.js`.
 */
const REPORT_BIN = resolve(import.meta.dirname, '../fixtures/lint-cli/report.sh');

export const { cleanup, cli } = await specification.cli(REPORT_BIN, { transform: lintReport });

afterAll(cleanup);
