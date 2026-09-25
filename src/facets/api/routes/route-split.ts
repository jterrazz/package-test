import { join } from 'node:path';

import { partialShards, readShardLedgers, ROUTES_DIR } from './ledger.js';
import { judgeLedgers } from './route-judge.js';
import type { RouteRun, RouteVerdict } from './route-judge.js';

/** The failure of a merge that finds no shard's ledgers to judge. */
export const NO_SHARD_LEDGERS =
    `api routes: not judged — no shard's ledgers under ${ROUTES_DIR}/shard-*/, so the merge has no run to judge: ` +
    'run every shard (`make test SHARD=<index>/<count>`) before the merge, since a whole run empties the shard folders';

/** The line the merge of a split prints when a test name filtered one of its shards. */
export function partialSplitUnjudged(shards: readonly string[]): string {
    return `api routes: not judged — ${shards.join(', ')} ran under a test name filter (-t), so the split reaches only some routes`;
}

/**
 * The route ratchet of a split run, judged once its shards have run.
 *
 * Each shard of the run writes its ledgers to a folder of its own and judges
 * nothing; the merge reads every shard's ledgers as one run's and judges them
 * as the whole run's teardown would. A ledger a whole run left beside them is
 * not the split's, and is not read. A merge that finds no shard's ledgers
 * fails: a split of an api project always writes some, so none means the
 * shards never ran or a whole run emptied their folders since. A split one
 * shard of which a test name filtered is partial, and is not judged.
 */
export async function judgeSplit(
    root: string,
    run: Omit<RouteRun, 'scope'>,
): Promise<RouteVerdict> {
    const directory = join(root, ROUTES_DIR);
    const partial = partialShards(directory);
    if (partial.length > 0) {
        return { line: partialSplitUnjudged(partial) };
    }
    const ledgers = readShardLedgers(directory);
    if (ledgers.length === 0) {
        return { failure: NO_SHARD_LEDGERS };
    }
    return await judgeLedgers(root, ledgers, {
        ...run,
        scope: 'whole',
    });
}
