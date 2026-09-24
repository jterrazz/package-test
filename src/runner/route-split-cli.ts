#!/usr/bin/env node
/* oxlint-disable eslint/no-console -- this file IS the CLI: its output is the product, and a gate that wrote anywhere else would be reporting to nobody. */
import { resolve } from 'node:path';

import { judgeSplit } from './route-split.js';
import { shouldUpdateSnapshots } from './update.js';

/**
 * CLI for the route ratchet of a split run (bundled as `dist/route-split.js`).
 *
 *     node dist/route-split.js    # judge every shard's ledgers as one run's
 *
 * It runs after `vitest --merge-reports`, which runs no global setup: a merge
 * that failed stops before it, so the run it judges is green. `TEST_UPDATE=1`
 * records where the split stands, as a whole run's teardown does.
 */
const { failure, line } = await judgeSplit(resolve('.'), {
    failed: 0,
    update: shouldUpdateSnapshots(),
});
if (failure !== undefined) {
    console.error(failure);
    process.exit(1);
}
if (line !== undefined) {
    console.log(line);
}
