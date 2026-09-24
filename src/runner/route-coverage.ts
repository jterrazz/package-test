import { join } from 'node:path';
import type { TestProject } from 'vitest/node';

import {
    clearLedgers,
    declaredRoutes,
    heldUnreached,
    measure,
    readLedgers,
    recordUnreached,
    ROUTES_DIR,
    ROUTES_KEY,
    unreachedRoutes,
} from '../model/routes/routes.js';
import type { Route } from '../model/routes/routes.js';
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

/** What the judge is told of the run: whether it records, and how many of its files failed. */
export type RouteRun = { failed: number; update: boolean };

/**
 * Judge the run's measure: the line the report prints, or the error that
 * fails the run — `undefined` for a run no api specification wrote to.
 */
export async function judgeRoutes(
    root: string,
    directory: string,
    { failed, update }: RouteRun,
): Promise<{ failure?: string; line?: string }> {
    const ledgers = readLedgers(directory);
    if (ledgers.length === 0) {
        return {};
    }
    if (failed > 0) {
        const why = `${failed} file(s) of the run failed, and a failed file may not have sent its requests`;
        return update
            ? {
                  failure: `api routes: not recorded — ${why}; make the run green, then record with TEST_UPDATE=1`,
              }
            : { line: `api routes: not judged — ${why}` };
    }
    const run = measure(ledgers);
    const table = (await declaredRoutes(root)) ?? run.declared;
    if (table === undefined) {
        return { failure: UNKNOWN_TABLE };
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
    const directory = join(root, ROUTES_DIR);
    clearLedgers(directory);
    project.provide('routesLedger', directory);
    return async () => {
        const { failure, line } = await judgeRoutes(root, directory, {
            failed: project.vitest.state.getFailedFilepaths().length,
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
