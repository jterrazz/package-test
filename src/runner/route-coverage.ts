import { join } from 'node:path';
import type { TestProject } from 'vitest/node';

import {
    clearLedgers,
    declaredMethodless,
    declaredRoutes,
    heldUnreached,
    measure,
    readLedgers,
    recordUnreached,
    ROUTES_DIR,
    ROUTES_KEY,
    shardLedgersDir,
    unreachedRoutes,
} from '../model/routes/routes.js';
import type { Ledger, Route, Shard } from '../model/routes/routes.js';
import { shouldUpdateSnapshots } from './update.js';

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
 * of the run's, so it writes them to a folder of its own and prints that they
 * wait for the merge, whose judge is `route-split.ts` — `vitest
 * --merge-reports` runs no global setup, so the merge calls it itself.
 *
 * The app's own table also holds the member's `test: { methodless }` to what
 * it declares: the routes it takes on any method (`ALL`) are exactly the paths
 * the list names, or the run fails naming each drift — the checker files a
 * spec of such a route by its path, and a list nothing checks would drift
 * from the app unseen. The list is judged whenever the app exposes a table of
 * its own, an OpenAPI document declared or not, and is left unjudged only
 * when it exposes none.
 */

/** The failure of a run whose app exposes no route table, and names none. */
export const UNKNOWN_TABLE =
    'api routes: an app specification.api() started exposes no route table, so no route can be judged reached — ' +
    'hand `server` the Hono app itself (its `app.routes` is the table), or declare the routes as an OpenAPI document: ' +
    "`test: { routes: './openapi.yaml' }` in jterrazz.config.ts.";

/** How a route reads in the report. */
function spelled(route: Route): string {
    return `${route.method} ${route.path}`;
}

/**
 * What the judge is told of the run: whether it records, how many of its
 * files failed, and whether it is one shard of a split run.
 */
export type RouteRun = { failed: number; shard: boolean; update: boolean };

/** The line a shard prints in place of a verdict. */
export const SHARD_UNJUDGED =
    "api routes: not judged — a shard's ledgers are a part of the run, and the merge of the split judges them";

/** A path with its parameters' names dropped: `/mcp/:id` and `/mcp/:session` are one route. */
function shapeOf(path: string): string {
    return path.replaceAll(/:[^/]+/gu, ':');
}

/**
 * Where the method-less list and the app's table disagree: each route the
 * table takes on any method that the list misses, then each path the list
 * names that the table does not take on any method — nothing when they agree.
 */
function methodlessDrift(table: readonly Route[], methodless: readonly string[]): string[] {
    const named = new Set(methodless.map((path) => shapeOf(path)));
    const any = [
        ...new Map(
            table
                .filter((route) => route.method === 'ALL')
                .map((route) => [shapeOf(route.path), route.path]),
        ),
    ];
    const taken = new Set(any.map(([shape]) => shape));
    const missed = any
        .filter(([shape]) => !named.has(shape))
        .map(
            ([, path]) =>
                `  ALL ${path} — the app takes it on any method, and the list misses it: add '${path}'`,
        );
    const stale = methodless
        .filter((path) => !taken.has(shapeOf(path)))
        .map((path) =>
            table.some((route) => shapeOf(route.path) === shapeOf(path))
                ? `  ${path} — the list names it, and the app takes it on its own methods only: remove '${path}'`
                : `  ${path} — the list names it, and the app's table holds no such route: remove '${path}'`,
        );
    return [...missed, ...stale];
}

/** What the judge returns: the line the report prints, or the error that fails the run. */
export type RouteVerdict = { failure?: string; line?: string };

/**
 * Judge the run's measure, read from the ledgers in `directory` — nothing for
 * a run no api specification wrote to.
 */
export async function judgeRoutes(
    root: string,
    directory: string,
    run: RouteRun,
): Promise<RouteVerdict> {
    return await judgeLedgers(root, readLedgers(directory), run);
}

/** What a run no verdict may be read from prints: a shard's, or one a file of which failed. */
function unjudgedRun({ failed, shard, update }: RouteRun): RouteVerdict | undefined {
    if (shard) {
        return { line: SHARD_UNJUDGED };
    }
    if (failed === 0) {
        return undefined;
    }
    const why = `${failed} file(s) of the run failed, and a failed file may not have sent its requests`;
    return update
        ? {
              failure: `api routes: not recorded — ${why}; make the run green, then record with TEST_UPDATE=1`,
          }
        : { line: `api routes: not judged — ${why}` };
}

/** Judge the run's measure over its ledgers — nothing when there are none. */
export async function judgeLedgers(
    root: string,
    ledgers: readonly Ledger[],
    { failed, shard, update }: RouteRun,
): Promise<RouteVerdict> {
    if (ledgers.length === 0) {
        return {};
    }
    const unjudged = unjudgedRun({ failed, shard, update });
    if (unjudged !== undefined) {
        return unjudged;
    }
    const run = measure(ledgers);
    const table = (await declaredRoutes(root)) ?? run.declared;
    if (table === undefined) {
        return { failure: UNKNOWN_TABLE };
    }
    const drift =
        run.declared === undefined
            ? []
            : methodlessDrift(run.declared, await declaredMethodless(root));
    if (drift.length > 0) {
        return {
            failure: `api routes: \`test: { methodless }\` in jterrazz.config.ts names the routes the app takes on any method, and it drifted from the app's table — the checker files a spec of one by its path, whatever verb it sends:\n${drift.join('\n')}`,
        };
    }
    // Every specification of the run declares the same table: a route counts once.
    const declared = [...new Map(table.map((route) => [spelled(route), route])).values()];
    const missing = unreachedRoutes(declared, run.reached);
    const named = missing.map((route) => `  ${spelled(route)}`).join('\n');
    if (update) {
        recordUnreached(root, missing.length);
        return {
            line: `api routes: ${missing.length} unreached recorded under jterrazz.baseline.json › test › ${ROUTES_KEY}`,
        };
    }
    const held = heldUnreached(root);
    if (missing.length > held) {
        return {
            failure: `api routes: ${missing.length} declared route(s) no test reached, the ratchet holds ${held} — send each from a spec, or record them with TEST_UPDATE=1:\n${named}`,
        };
    }
    if (missing.length < held) {
        return {
            failure: `api routes: ${missing.length} declared route(s) no test reached, below the ${held} the ratchet holds — the debt fell, record it with TEST_UPDATE=1`,
        };
    }
    return {
        line:
            missing.length === 0
                ? `api routes: all ${declared.length} declared routes reached`
                : `api routes: ${missing.length} unreached, held by jterrazz.baseline.json › test › ${ROUTES_KEY}:\n${named}`,
    };
}

export default function setup(project: TestProject): () => Promise<void> {
    const { root } = project.config;
    const shard: Shard | undefined = project.vitest.config.shard;
    const directory = join(root, shard === undefined ? ROUTES_DIR : shardLedgersDir(shard));
    clearLedgers(directory);
    project.provide('routesLedger', directory);
    return async () => {
        const { failure, line } = await judgeRoutes(root, directory, {
            failed: project.vitest.state.getFailedFilepaths().length,
            shard: shard !== undefined,
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
