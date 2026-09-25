import { join } from 'node:path';
import type { TestProject } from 'vitest/node';

import { shouldUpdateSnapshots } from '../../../expectations/in-place/update.js';
import { clearLedgers, markPartial, ROUTES_DIR, shardLedgersDir } from './ledger.js';
import type { Shard } from './ledger.js';
import { judgeRoutes } from './route-judge.js';
import type { RunScope } from './route-judge.js';

/**
 * The api project's global setup: route coverage, measured over the run.
 *
 * Before the first test it clears the run's ledger folder and hands its path
 * to the workers — each `specification.api()` writes what its app declares
 * and what it was sent when it cleans up. After the last test it reads every
 * ledger and judges the declared routes no request reached against the
 * ratchet, which is exact: more than `jterrazz.baseline.json › test` holds
 * fails the run, naming each, and fewer fails it too — the debt fell, and the
 * entry says where the run stood; `TEST_UPDATE=1` records where it stands.
 * A run a file of which failed is neither judged nor recorded: a failed file
 * may have sent none of its requests, so its run is no count.
 * The run is the key's one judge: it alone counts the routes. An app whose
 * table is unknown — no `app.routes`, no OpenAPI document declared — fails
 * the run too: a measure against nothing reads as every route reached.
 *
 * A shard of a split run (`--shard`) judges nothing: its ledgers are a part
 * of the run's, so it writes them to a folder of its own, and the judge of
 * every shard's ledgers is `route-split.ts` — `vitest --merge-reports` runs
 * no global setup, so the merge calls it itself. A shard a test name filters
 * marks its folder partial, and the merge of a split holding one judges
 * nothing either.
 *
 * Neither is any other partial run judged or recorded — `--changed`, a file
 * filter, `-t`: one that ran some of the project's files, or some of its
 * tests, reached only some routes, and the ratchet counts the whole run's.
 *
 * The app's own table also holds the member's `test: { methodless }` to what
 * it declares: the routes it takes on any method (`ALL`) are exactly the paths
 * the list names, or the run fails naming each drift — the checker files a
 * spec of such a route by its path, and a list nothing checks would drift
 * from the app unseen. The list is judged whenever the app exposes a table of
 * its own, an OpenAPI document declared or not, and is left unjudged only
 * when it exposes none.
 */

/** What the setup reads of the vitest project it runs for. */
export type RouteProject = {
    config: { root: string };
    globTestFiles: () => Promise<{ testFiles: string[] }>;
    name: string;
    provide: (key: 'routesLedger', value: string) => void;
    vitest: {
        config: { shard?: Shard | undefined; testNamePattern?: RegExp | undefined };
        state: {
            getFailedFilepaths: () => string[];
            getFiles: () => readonly { filepath: string; projectName?: string | undefined }[];
        };
    };
};

/**
 * How much of the project the run ran: a shard's, or partial when a test name
 * filters it or one of the project's test files did not run.
 */
async function scopeOf(project: RouteProject): Promise<RunScope> {
    if (project.vitest.config.shard !== undefined) {
        return 'shard';
    }
    if (project.vitest.config.testNamePattern !== undefined) {
        return 'partial';
    }
    const ran = new Set(
        project.vitest.state
            .getFiles()
            .filter((file) => file.projectName === project.name)
            .map((file) => file.filepath),
    );
    const { testFiles } = await project.globTestFiles();
    return testFiles.every((file) => ran.has(file)) ? 'whole' : 'partial';
}

/** The setup over what it reads of the project: the ledger folder handed out, and the teardown that judges. */
export function setupRoutes(project: RouteProject): () => Promise<void> {
    const { root } = project.config;
    const shard: Shard | undefined = project.vitest.config.shard;
    const directory = join(root, shard === undefined ? ROUTES_DIR : shardLedgersDir(shard));
    clearLedgers(directory);
    if (shard !== undefined && project.vitest.config.testNamePattern !== undefined) {
        markPartial(directory);
    }
    project.provide('routesLedger', directory);
    return async () => {
        const { failure, line } = await judgeRoutes(root, directory, {
            failed: project.vitest.state.getFailedFilepaths().length,
            scope: await scopeOf(project),
            update: shouldUpdateSnapshots(),
        });
        if (failure !== undefined) {
            throw new Error(failure);
        }
        if (line !== undefined) {
            process.stdout.write(`${line}\n`);
        }
    };
}

export default function setup(project: TestProject): () => Promise<void> {
    return setupRoutes(project);
}
