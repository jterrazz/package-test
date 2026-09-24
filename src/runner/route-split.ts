import { join } from 'node:path';

import { readShardLedgers, ROUTES_DIR } from '../model/routes/routes.js';
import { judgeLedgers } from './route-coverage.js';
import type { RouteRun, RouteVerdict } from './route-coverage.js';

/**
 * The route ratchet of a split run, judged once its shards have run.
 *
 * Each shard of the run writes its ledgers to a folder of its own and judges
 * nothing; the merge reads every shard's ledgers as one run's and judges them
 * as the whole run's teardown would. A ledger a whole run left beside them is
 * not the split's, and is not read.
 */
export async function judgeSplit(
    root: string,
    run: Omit<RouteRun, 'shard'>,
): Promise<RouteVerdict> {
    return await judgeLedgers(root, readShardLedgers(join(root, ROUTES_DIR)), {
        ...run,
        shard: false,
    });
}
