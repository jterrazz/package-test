import {
    heldUnreached,
    recordUnreached,
    ROUTES_LEDGER,
} from '../../../../lint/kit/baseline/test-baseline.js';
import type { Lesson } from '../../../chain/refusals/refusal.js';
import { measure, readLedgers } from './ledger.js';
import type { Ledger } from './ledger.js';
import { methodlessDrift, methodlessDrifted } from './methodless.js';
import { declaredMethodless, declaredRoutes, unreachedRoutes } from './routes.js';
import type { Route } from './routes.js';

export const UNKNOWN_TABLE: Lesson = {
    fix: "hand `server` the Hono app itself (its `app.routes` is the table), or declare the routes as an OpenAPI document: `test: { routes: './openapi.yaml' }` in jterrazz.config.ts",
    found: 'api routes: an app specification.api() started exposes no route table',
    read: 'docs/guides/api-specs.md#an-app-that-is-not-hono',
    why: 'A route is judged reached against the table the app declares.',
};

function spelled(route: Route): string {
    return `${route.method} ${route.path}`;
}

export type RunScope = 'partial' | 'shard' | 'whole';

export type RouteRun = { failed: number; scope: RunScope; update: boolean };

export const SHARD_UNJUDGED =
    "api routes: not judged — a shard's ledgers are a part of the run's; the route ratchet is judged only over every shard's ledgers (docs/guides/api-specs.md)";

export const PARTIAL_UNJUDGED =
    'api routes: not judged — a partial run (--changed, a file filter or -t) reaches only some routes';

export type RouteVerdict = { failure?: Lesson; line?: string };

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
              failure: {
                  fix: 'make the run green, then record with TEST_UPDATE=1',
                  found: `api routes: not recorded — ${why}`,
                  read: 'docs/guides/api-specs.md#when-a-run-is-not-judged',
                  why: 'The route ratchet is recorded only from a run that is green and whole.',
              },
          }
        : { line: `api routes: not judged — ${why}` };
}

function ratchetMoved(missing: number, held: number, named: string): Lesson {
    // Stryker disable next-line EqualityOperator: read only once the count moved, so never at the ratchet
    return missing > held
        ? {
              fix: 'send each from a spec, or record them with TEST_UPDATE=1',
              found: `api routes: ${missing} declared route(s) no test reached, and the ratchet holds ${held}:\n${named}`,
              read: 'docs/guides/api-specs.md#the-ratchet',
              why: 'A route no test reached fails the run, beyond the count the ratchet holds.',
          }
        : {
              fix: 'the debt fell: record it with TEST_UPDATE=1',
              found: `api routes: ${missing} declared route(s) no test reached, below the ${held} the ratchet holds`,
              read: 'docs/guides/api-specs.md#the-ratchet',
              why: 'The ratchet is exact in both directions.',
          };
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
        return { failure: methodlessDrifted(drift) };
    }
    // invariant: every specification of the run declares the same table: a route counts once.
    const declared = [...new Map(table.map((route) => [spelled(route), route])).values()];
    const missing = unreachedRoutes(declared, run.reached);
    const named = missing.map((route) => `  ${spelled(route)}`).join('\n');
    if (update) {
        recordUnreached(root, missing.length);
        return {
            line: `api routes: ${missing.length} unreached recorded under ${ROUTES_LEDGER}`,
        };
    }
    const held = heldUnreached(root);
    if (missing.length !== held) {
        return { failure: ratchetMoved(missing.length, held, named) };
    }
    return {
        line:
            missing.length === 0
                ? `api routes: all ${declared.length} declared routes reached`
                : `api routes: ${missing.length} unreached, held by ${ROUTES_LEDGER}:\n${named}`,
    };
}
