import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { testSectionAt } from '../../../kernel/config/test-section.js';
import { parseYamlSource } from '../../../kernel/files/yaml-document.js';

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
 * This module is the matching: a route, a request sent, which reaches which,
 * and the routes a member declares. What a run writes and reads back is
 * `ledger.ts`; the count the run ratchets is `baseline.ts`.
 */

/** One route: an HTTP method and a path, parameters written `:id` or `{id}`. */
export type Route = { method: string; path: string };

/** A request a test sent: the path it reached, and the route template it was written as, when it was. */
export type SentRequest = Route & { template?: string };

/** A plain object — never an array, never null. */
function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The HTTP methods an OpenAPI path item may hold. */
const METHODS = new Set(['delete', 'get', 'head', 'options', 'patch', 'post', 'put', 'trace']);

/** Is this segment a parameter — `:id` in a table or a template, `{id}` in an OpenAPI document? */
function isParameter(segment: string): boolean {
    return segment.startsWith(':') || /^\{[^}]+\}$/u.test(segment);
}

/**
 * Does a declared segment take the sent one? A parameter takes any value and,
 * from a template, only a parameter; a literal takes itself.
 */
function takesSegment(declared: string, sent: string | undefined, template: boolean): boolean {
    if (sent === undefined) {
        return false;
    }
    if (template && isParameter(sent)) {
        return isParameter(declared);
    }
    return isParameter(declared) ? sent.length > 0 && !template : sent === declared;
}

/**
 * Does a request sent reach a declared route? A request written as a template
 * is matched by its template — a parameter where the route has one, each
 * literal segment itself — and any other by its path. An `ALL` route takes any
 * method, a `*` tail the rest of the path.
 */
export function reachesRoute(route: Route, sent: SentRequest): boolean {
    if (route.method !== 'ALL' && route.method !== sent.method) {
        return false;
    }
    const template = sent.template !== undefined;
    const declared = route.path.split('/');
    const segments = ((sent.template ?? sent.path).split('?')[0] ?? '').split('/');
    if (declared.at(-1) === '*') {
        return declared
            .slice(0, -1)
            .every((segment, index) => takesSegment(segment, segments[index], template));
    }
    return (
        declared.length === segments.length &&
        declared.every((segment, index) => takesSegment(segment, segments[index], template))
    );
}

/** The declared routes no request reached, each named once, in the order they were declared. */
export function unreachedRoutes(
    declared: readonly Route[],
    reached: readonly SentRequest[],
): Route[] {
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
 * declares none.
 */
export async function declaredRoutes(root: string): Promise<Route[] | undefined> {
    const { routes } = await testSectionAt(root);
    if (routes === undefined) {
        return undefined;
    }
    return openApiRoutes(readFileSync(join(root, routes), 'utf8'), routes.endsWith('.json'));
}

/**
 * The paths the member at `root` names method-less in its
 * `jterrazz.config.ts` — `test.methodless` — or none.
 */
export async function declaredMethodless(root: string): Promise<string[]> {
    const { methodless } = await testSectionAt(root);
    return [...(methodless ?? [])];
}
