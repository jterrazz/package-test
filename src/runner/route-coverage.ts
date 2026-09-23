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
 * ratchet: more than `jterrazz.baseline.json › test` holds fails the run,
 * naming each; `TEST_UPDATE=1` records where the run stands.
 */

/** How a route reads in the report. */
function spelled(route: Route): string {
    return `${route.method} ${route.path}`;
}

/**
 * Judge the run's measure: the line the report prints, or the error that
 * fails the run — `undefined` for a run no api specification wrote to.
 */
export async function judgeRoutes(
    root: string,
    directory: string,
    update: boolean,
): Promise<{ failure?: string; line?: string }> {
    const ledgers = readLedgers(directory);
    if (ledgers.length === 0) {
        return {};
    }
    const run = measure(ledgers);
    const table = (await declaredRoutes(root)) ?? run.declared;
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
        const { failure, line } = await judgeRoutes(root, directory, shouldUpdateSnapshots());
        if (failure !== undefined) {
            throw new Error(failure);
        }
        if (line !== undefined) {
            process.stdout.write(`${line}\n`);
        }
    };
}
