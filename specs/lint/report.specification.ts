import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { lintReport, specification } from '../../src/index.js';

/** Normalised by `lintReport`, so a golden proves where a rule fired and which one, never how its message is worded. `npm run build` first. */
const REPORT_BIN = resolve(import.meta.dirname, '../shared/fixtures/lint-cli/report.sh');

export const { cleanup, cli } = await specification.cli(REPORT_BIN, { transform: lintReport });

afterAll(cleanup);
