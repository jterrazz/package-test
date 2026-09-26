import { ROUTES_KEY } from '../../../../lint/engine/baseline/ratchet.js';
import { heldUnreached, recordUnreached } from './baseline.js';
import { measure, readLedgers } from './ledger.js';
import type { Ledger } from './ledger.js';
import { declaredMethodless, declaredRoutes, unreachedRoutes } from './routes.js';
import type { Route } from './routes.js';

export const UNKNOWN_TABLE =
    'api routes: an app specification.api() started exposes no route table, so no route can be judged reached — ' +
    'hand `server` the Hono app itself (its `app.routes` is the table), or declare the routes as an OpenAPI document: ' +
    "`test: { routes: './openapi.yaml' }` in jterrazz.config.ts.";

function spelled(route: Route): string {
    return `${route.method} ${route.path}`;
}

export type RunScope = 'partial' | 'shard' | 'whole';

export type RouteRun = { failed: number; scope: RunScope; update: boolean };

export const SHARD_UNJUDGED =
    "api routes: not judged — a shard's ledgers are a part of the run's; the route ratchet is judged only over every shard's ledgers (docs/10)";

export const PARTIAL_UNJUDGED =
    'api routes: not judged — a partial run (--changed, a file filter or -t) reaches only some routes';

function shapeOf(path: string): string {
    return path.replaceAll(/:[^/]+/gu, ':');
}

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

export type RouteVerdict = { failure?: string; line?: string };

export async function judgeRoutes(
    root: string,
    directory: string,
    run: RouteRun,
): Promise<RouteVerdict> {
    return await judgeLedgers(root, readLedgers(directory), run);
}

function unjudgedRun({ failed, scope, update }: RouteRun): RouteVerdict | undefined {
    if (scope === 'shard') {
        return { line: SHARD_UNJUDGED };
    }
    if (scope === 'partial') {
        return { line: PARTIAL_UNJUDGED };
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

export async function judgeLedgers(
    root: string,
    ledgers: readonly Ledger[],
    { failed, scope, update }: RouteRun,
): Promise<RouteVerdict> {
    if (ledgers.length === 0) {
        return {};
    }
    const unjudged = unjudgedRun({ failed, scope, update });
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
