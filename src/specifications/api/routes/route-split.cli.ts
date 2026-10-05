#!/usr/bin/env node
/* oxlint-disable eslint/no-console -- this file IS the CLI: its output is the product, and a gate that wrote anywhere else would be reporting to nobody. */
import { resolve } from 'node:path';

import { refusal } from '../../../chain/refusals/refusal.js';
import { shouldUpdateSnapshots } from '../../../expectations/in-place/update.js';
import { judgeSplit } from './route-split.js';

/** Runs after `vitest --merge-reports`, which runs no global setup; a failed merge stops before it. */
const { failure, line } = await judgeSplit(resolve('.'), {
    failed: 0,
    update: shouldUpdateSnapshots(),
});
if (failure !== undefined) {
    console.error(refusal(failure));
    process.exit(1);
}
if (line !== undefined) {
    console.log(line);
}
