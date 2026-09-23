import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseYamlSource } from '../../seams/yaml/document.js';
import { VITEST_ARTIFACTS_DIR } from '../artifacts/artifacts.js';

/**
 * Route coverage, measured at run time.
 *
 * Line coverage says which lines of the app ran; it cannot say which of the
 * app's routes no case ever asked for, and a route nobody asks for is a
 * behaviour nobody specified. The api facet records every request a test
 * sends, and the app's own route table — Hono's `app.routes` — is what the
 * requests are measured against, read from the app a specification started:
 * the table that serves the tests, never a copy that can drift from it. A
 * member may declare an OpenAPI document instead (`test: { routes }` in its
 * `jterrazz.config.ts`), for an app whose table no adapter reads.
 *
 * Each specification writes its ledger — the routes its app declares, the
 * requests it sent — when it cleans up; the api project's global teardown
 * reads every ledger of the run and names each declared route no request
 * reached. The count is ratcheted in `jterrazz.baseline.json › test`, under
 * {@link ROUTES_KEY}: the checker reads and writes that section too, and
 * leaves this key to the run.
 */

/** One route: an HTTP method and a path, parameters written `:id` or `{id}`. */
export type Route = { method: string; path: string };

/**
 * What one specification of the run declared and sent — `declared` absent
 * when its app exposes no route table.
 */
export type Ledger = { declared?: Route[] | undefined; reached: Route[] };

/** The ratchet key the run owns in the `test` section — the unreached routes it holds. */
export const ROUTES_KEY = 'routes/unreached';

/** Where the run's ledgers are written, below the project root. */
export const ROUTES_DIR = `${VITEST_ARTIFACTS_DIR}/routes`;

/** The HTTP methods an OpenAPI path item may hold. */
const METHODS = new Set(['delete', 'get', 'head', 'options', 'patch', 'post', 'put', 'trace']);

/** A plain object — never an array, never null. */
function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Does a declared segment take the sent one: a parameter takes any, a literal itself. */
function takesSegment(declared: string, sent: string | undefined): boolean {
    if (sent === undefined) {
        return false;
    }
    const parameter = declared.startsWith(':') || /^\{[^}]+\}$/u.test(declared);
    return parameter ? sent.length > 0 : sent === declared;
}

/** Does a request sent reach a declared route? An `ALL` route takes any method, a `*` tail the rest of the path. */
export function reachesRoute(route: Route, sent: Route): boolean {
    if (route.method !== 'ALL' && route.method !== sent.method) {
        return false;
    }
    const declared = route.path.split('/');
    const segments = (sent.path.split('?')[0] ?? '').split('/');
    if (declared.at(-1) === '*') {
        return declared
            .slice(0, -1)
            .every((segment, index) => takesSegment(segment, segments[index]));
    }
    return (
        declared.length === segments.length &&
        declared.every((segment, index) => takesSegment(segment, segments[index]))
    );
}

/** The declared routes no request reached, each named once, in the order they were declared. */
export function unreachedRoutes(declared: readonly Route[], reached: readonly Route[]): Route[] {
    const seen = new Set<string>();
    return declared.filter((route) => {
        const key = `${route.method} ${route.path}`;
        if (seen.has(key) || reached.some((sent) => reachesRoute(route, sent))) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

/** The routes an OpenAPI document declares: every method of every path. */
export function openApiRoutes(text: string, json: boolean): Route[] {
    const parsed: unknown = json ? JSON.parse(text) : parseYamlSource(text).document.toJSON();
    const paths = isRecord(parsed) ? parsed.paths : undefined;
    if (!isRecord(paths)) {
        return [];
    }
    return Object.entries(paths).flatMap(([path, item]) =>
        isRecord(item)
            ? Object.keys(item)
                  .filter((method) => METHODS.has(method))
                  .map((method) => ({ method: method.toUpperCase(), path }))
            : [],
    );
}

/**
 * The routes the member at `root` declares in its `jterrazz.config.ts` —
 * `test.routes`, a path to an OpenAPI document — or `undefined` when it
 * declares none. Node loads the file, types stripped, as the toolchain loads
 * its own section.
 */
export async function declaredRoutes(root: string): Promise<Route[] | undefined> {
    const settings = join(root, 'jterrazz.config.ts');
    if (!existsSync(settings)) {
        return undefined;
    }
    const loaded: unknown = await import(pathToFileURL(settings).href);
    const config = isRecord(loaded) ? loaded.default : undefined;
    const test = isRecord(config) ? config.test : undefined;
    const source = isRecord(test) ? test.routes : undefined;
    if (typeof source !== 'string') {
        return undefined;
    }
    return openApiRoutes(readFileSync(join(root, source), 'utf8'), source.endsWith('.json'));
}

/** Forget the ledgers a previous run left in `directory` — the run measures from nothing. */
export function clearLedgers(directory: string): void {
    rmSync(directory, { force: true, recursive: true });
}

/** Write one specification's ledger into the run's `directory`, under a name no other takes. */
export function writeLedger(directory: string, ledger: Ledger): void {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, `${randomUUID()}.json`), `${JSON.stringify(ledger)}\n`);
}

/** Every ledger the run wrote into `directory`. */
export function readLedgers(directory: string): Ledger[] {
    if (!existsSync(directory)) {
        return [];
    }
    return readdirSync(directory)
        .filter((name) => name.endsWith('.json'))
        .map((name) => JSON.parse(readFileSync(join(directory, name), 'utf8')) as Ledger);
}

/**
 * The run's measure: the routes declared and the requests sent, over every
 * ledger — `declared` absent when a specification's app exposed no table.
 */
export function measure(ledgers: readonly Ledger[]): Ledger {
    const tables = ledgers.map((ledger) => ledger.declared);
    return {
        declared: tables.every((table) => table !== undefined) ? tables.flat() : undefined,
        reached: ledgers.flatMap((ledger) => ledger.reached),
    };
}

/** The unreached routes the project's ratchet holds — 0 when it holds none. */
export function heldUnreached(root: string): number {
    const path = join(root, 'jterrazz.baseline.json');
    if (!existsSync(path)) {
        return 0;
    }
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const test = isRecord(parsed) ? parsed.test : undefined;
    const held = isRecord(test) ? test[ROUTES_KEY] : undefined;
    return typeof held === 'number' ? held : 0;
}

/**
 * Record `count` as the unreached routes the ratchet holds, in the `test`
 * section of `jterrazz.baseline.json` — every other key kept, the entry
 * removed at zero.
 */
export function recordUnreached(root: string, count: number): void {
    const path = join(root, 'jterrazz.baseline.json');
    const parsed: unknown = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
    const file = isRecord(parsed) ? parsed : {};
    const others = Object.entries(isRecord(file.test) ? file.test : {}).filter(
        ([key]) => key !== ROUTES_KEY,
    );
    const test = Object.fromEntries(count === 0 ? others : [...others, [ROUTES_KEY, count]]);
    const sorted = Object.fromEntries(
        Object.entries(test).toSorted(([a], [b]) => (a < b ? -1 : 1)),
    );
    writeFileSync(path, `${JSON.stringify({ ...file, test: sorted }, null, 4)}\n`);
}

/** Where the run collects the ledgers — the path the api project's global setup provides to its workers. */
declare module 'vitest' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- a module augmentation MERGES only as an interface; a type alias redeclares the name and every member is lost
    interface ProvidedContext {
        /** Where each api specification writes its route ledger. */
        routesLedger?: string;
    }
}
