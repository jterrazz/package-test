import { join } from 'node:path';

import { readShardLedgers, ROUTES_DIR } from '../model/routes/routes.js';
import { judgeLedgers } from './route-judge.js';
import type { RouteRun, RouteVerdict } from './route-judge.js';

/** The failure of a merge that finds no shard's ledgers to judge. */
export const NO_SHARD_LEDGERS =
    `api routes: not judged — no shard's ledgers under ${ROUTES_DIR}/shard-*/, so the merge has no run to judge: ` +
    'run every shard (`make test SHARD=<index>/<count>`) before the merge, since a whole run empties the shard folders';

/**
 * The route ratchet of a split run, judged once its shards have run.
 *
 * Each shard of the run writes its ledgers to a folder of its own and judges
 * nothing; the merge reads every shard's ledgers as one run's and judges them
 * as the whole run's teardown would. A ledger a whole run left beside them is
 * not the split's, and is not read. A merge that finds no shard's ledgers
 * fails: a split of an api project always writes some, so none means the
 * shards never ran or a whole run emptied their folders since.
 */
export async function judgeSplit(
    root: string,
    run: Omit<RouteRun, 'scope'>,
): Promise<RouteVerdict> {
    const ledgers = readShardLedgers(join(root, ROUTES_DIR));
    if (ledgers.length === 0) {
        return { failure: NO_SHARD_LEDGERS };
    }
    return await judgeLedgers(root, ledgers, {
        ...run,
        scope: 'whole',
    });
}
