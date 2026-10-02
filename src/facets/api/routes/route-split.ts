import { join } from 'node:path';

import type { Lesson } from '../../../../lint/refusal.js';
import { partialShards, readShardLedgers, ROUTES_DIR } from './ledger.js';
import { judgeLedgers } from './route-judge.js';
import type { RouteRun, RouteVerdict } from './route-judge.js';

export const NO_SHARD_LEDGERS: Lesson = {
    fix: 'run every shard (`make test SHARD=<index>/<count>`) before the merge, since a whole run empties the shard folders',
    found: `api routes: not judged — no shard's ledgers under ${ROUTES_DIR}/shard-*/`,
    read: 'docs/12-api.md#when-a-run-is-not-judged',
    why: 'The split judges the routes over every shard’s ledgers, so a merge with none has no run to judge.',
};

export function partialSplitUnjudged(shards: readonly string[]): string {
    return `api routes: not judged — ${shards.join(', ')} ran under a test name filter (-t), so the split reaches only some routes`;
}

/** A merge finding no shard's ledgers fails: a split of an api project always writes some. */
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
