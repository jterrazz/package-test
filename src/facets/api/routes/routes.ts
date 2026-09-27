import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { testSectionAt } from '../../../../lint/engine/project/test-settings.js';
import { parseYamlSource } from '../../../../lint/engine/project/yaml-document.js';

/** Measured against the app's own route table (Hono's `app.routes`) or a declared OpenAPI document. */

export type Route = { method: string; path: string };

export type SentRequest = Route & { template?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const METHODS = new Set(['delete', 'get', 'head', 'options', 'patch', 'post', 'put', 'trace']);

function isParameter(segment: string): boolean {
    return segment.startsWith(':') || /^\{[^}]+\}$/u.test(segment);
}

/** A parameter takes any value and, from a template, only a parameter; a literal takes itself. */
function takesSegment(declared: string, sent: string | undefined, template: boolean): boolean {
    if (sent === undefined) {
        return false;
    }
    if (template && isParameter(sent)) {
        return isParameter(declared);
    }
    return isParameter(declared) ? sent.length > 0 && !template : sent === declared;
}

/** A template request is matched by its template, any other by its path; `ALL` takes any method, a `*` tail the rest. */
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

export async function declaredRoutes(root: string): Promise<Route[] | undefined> {
    const { routes } = await testSectionAt(root);
    if (routes === undefined) {
        return undefined;
    }
    return openApiRoutes(readFileSync(join(root, routes), 'utf8'), routes.endsWith('.json'));
}

export async function declaredMethodless(root: string): Promise<string[]> {
    const { methodless } = await testSectionAt(root);
    return [...(methodless ?? [])];
}
