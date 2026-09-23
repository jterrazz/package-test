import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { isGroundName } from '../src/model/chain/ground.js';
import { treeEntries } from '../src/seams/git/tree.js';
import { isMap, isScalar, parseYamlSource } from '../src/seams/yaml/document.js';
import { blankComments } from './checker-crossfile.js';
import type { TokenViolation } from './checker.js';

/**
 * B12 — every route the api declares is reached by a spec.
 *
 * Line coverage says which lines of the app ran; it cannot say which of the
 * app's routes no case ever asked for, and a route nobody asks for is a
 * behaviour nobody specified. The route table is the one the member DECLARES
 * in `jterrazz.config.ts` — `test: { routes: './openapi.yaml' }`, an OpenAPI
 * document, JSON or YAML — because this pass is static: it runs in the lint,
 * before any test, and the served app's own table (Hono's `app.routes`) only
 * exists once its factory is handed started services.
 *
 * What reaches a route is read from the member's `specs/` tree the way a
 * reader reads it: a spec's literal `.get('/…')`, `.post(…)`, `.put(…)`, `.delete(…)` and the
 * `.http` file a `.request(file(…))` sends. A `{{capture}}` or a template
 * hole reaches any one segment; a computed path is out of reach, and the route
 * it would have reached is reported — the ratchet holds what a member accepts.
 */

/** The settings file, at the root of the unit it configures — the toolchain's name for it. */
const SETTINGS_FILE = 'jterrazz.config.ts';

/** What a member declares its routes by, once its settings are read. */
type RouteSource = null | { problem: string } | { source: string };

/** Each member's declared route source, read once per run before the passes. */
const declared = new Map<string, RouteSource>();

/** A plain object — never an array, never null. */
function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Read `test.routes` from every member's `jterrazz.config.ts`, the way the
 * toolchain reads its own section: Node loads the file, types stripped. A
 * file that does not load is the toolchain's to report; here it declares
 * nothing.
 */
export async function loadRouteSources(members: readonly string[]): Promise<void> {
    await Promise.all(
        members.map(async (member) => {
            const path = join(member, SETTINGS_FILE);
            if (!existsSync(path)) {
                declared.set(member, null);
                return;
            }
            try {
                const loaded: unknown = await import(pathToFileURL(path).href);
                const settings = isRecord(loaded) ? loaded.default : undefined;
                const test = isRecord(settings) ? settings.test : undefined;
                const routes = isRecord(test) ? test.routes : undefined;
                declared.set(
                    member,
                    routes === undefined
                        ? null
                        : typeof routes === 'string'
                          ? { source: routes }
                          : { problem: '`test.routes` is a path to an OpenAPI document' },
                );
            } catch {
                declared.set(member, null);
            }
        }),
    );
}

/** One route the source declares, and the line it declares it on. */
type Route = { line: number; method: string; path: string };

/** The HTTP methods an OpenAPI path item may hold. */
const METHODS = new Set(['delete', 'get', 'head', 'options', 'patch', 'post', 'put', 'trace']);

/** The line a JSON document spells `"<key>"` on — its first appearance as a key. */
function jsonLineOf(text: string, key: string): number {
    const index = text.indexOf(`${JSON.stringify(key)}:`);
    return index === -1 ? 1 : text.slice(0, index).split('\n').length;
}

/**
 * The routes an OpenAPI document declares: every method of every path, with
 * the line the path is written on — where a reader opens the source to see it.
 */
function routesOf(text: string, isJson: boolean): Route[] {
    let paths: unknown;
    let lineOf: (key: string) => number;
    if (isJson) {
        const parsed: unknown = JSON.parse(text);
        paths = isRecord(parsed) ? parsed.paths : undefined;
        lineOf = (key) => jsonLineOf(text, key);
    } else {
        const source = parseYamlSource(text);
        const parsed: unknown = source.document.toJSON();
        paths = isRecord(parsed) ? parsed.paths : undefined;
        const root = source.document.contents;
        const pathsNode = isMap(root) ? root.get('paths', true) : undefined;
        lineOf = (key) => {
            const pair = isMap(pathsNode)
                ? pathsNode.items.find((item) => isScalar(item.key) && item.key.value === key)
                : undefined;
            const range = isScalar(pair?.key) ? pair.key.range : undefined;
            return range === undefined || range === null ? 1 : source.lineAt(range[0]);
        };
    }
    if (!isRecord(paths)) {
        return [];
    }
    return Object.entries(paths).flatMap(([path, item]) =>
        isRecord(item)
            ? Object.keys(item)
                  .filter((method) => METHODS.has(method))
                  .map((method) => ({ line: lineOf(path), method: method.toUpperCase(), path }))
            : [],
    );
}

// ── What the specs reach ──

/** One request a spec or a document sends: its method and its path, holes marked. */
type Reach = { method: string; path: string };

/** A hole a request fills at run time — a capture, a template expression. */
const HOLE = '\u0000';

/** A literal request a spec sends through a verb that names its method. */
const VERB_CALL =
    /\.(?<method>get|post|put|delete)\(\s*(?<quote>['"`])(?<path>\/(?:[^'"`\\]|\\.)*)\k<quote>/gu;

/** A `.http` file a spec sends whole. */
const REQUEST_CALL = /\.request\(\s*file\(\s*(?<quote>['"`])(?<path>[^'"`]+)\k<quote>/gu;

/** The request line of a `.http` file, or nothing when it has none. */
function requestLineOf(path: string): Reach | undefined {
    let text: string;
    try {
        text = readFileSync(path, 'utf8');
    } catch {
        return undefined;
    }
    const first = text.split('\n').find((line) => line.trim().length > 0) ?? '';
    const match = /^(?<method>[A-Z]+)\s+(?<path>\/\S*)/u.exec(first.trim());
    const method = match?.groups?.method;
    const target = match?.groups?.path;
    return method === undefined || target === undefined ? undefined : { method, path: target };
}

/** What a `.spec.ts` sends, read from its code. */
function reachOfSpec(file: string): Reach[] {
    const text = blankComments(readFileSync(file, 'utf8'));
    const reached: Reach[] = [...text.matchAll(VERB_CALL)].map((match) => ({
        method: (match.groups?.method ?? '').toUpperCase(),
        path: (match.groups?.path ?? '').replaceAll(/\$\{[^}]*\}/gu, HOLE),
    }));
    for (const match of text.matchAll(REQUEST_CALL)) {
        const sent = requestLineOf(resolve(dirname(file), match.groups?.path ?? ''));
        if (sent !== undefined) {
            reached.push(sent);
        }
    }
    return reached;
}

/** Every spec under `dir`, ground left out. */
function readersUnder(dir: string): string[] {
    const found: string[] = [];
    const visit = (current: string): void => {
        let entries;
        try {
            entries = treeEntries(current);
        } catch {
            return;
        }
        for (const entry of entries) {
            const path = join(current, entry.name);
            if (entry.isDirectory()) {
                if (!isGroundName(entry.name) && entry.name !== 'node_modules') {
                    visit(path);
                }
            } else if (entry.name.endsWith('.spec.ts')) {
                found.push(path);
            }
        }
    };
    visit(dir);
    return found;
}

/** Does a request this spec sends reach the route? A parameter and a hole each take one segment. */
function reaches(route: Route, reach: Reach): boolean {
    if (route.method !== reach.method) {
        return false;
    }
    const declaredSegments = route.path.split('/');
    const sentSegments = (reach.path.split('?')[0] ?? '').split('/');
    if (declaredSegments.at(-1) === '*') {
        return declaredSegments
            .slice(0, -1)
            .every((segment, index) => matchesSegment(segment, sentSegments[index]));
    }
    return (
        declaredSegments.length === sentSegments.length &&
        declaredSegments.every((segment, index) => matchesSegment(segment, sentSegments[index]))
    );
}

/** One declared segment against one sent: a parameter takes any, a hole matches any. */
function matchesSegment(declaredSegment: string, sent: string | undefined): boolean {
    if (sent === undefined) {
        return false;
    }
    const parameter = declaredSegment.startsWith(':') || /^\{[^}]+\}$/u.test(declaredSegment);
    return parameter ? sent.length > 0 : sent === declaredSegment || sent.includes(HOLE);
}

/**
 * B12 over one member: each route its declared source names that no spec of its `specs/` tree reaches, reported on the line the source
 * declares it.
 */
export function checkRoutesReached(memberDir: string, rootDir: string): TokenViolation[] {
    const source = declared.get(memberDir) ?? null;
    if (source === null) {
        return [];
    }
    const at = (file: string, line: number, message: string): TokenViolation => ({
        file: relative(rootDir, file),
        line,
        message,
        rule: 'b12-route-reached',
        severity: 'error',
    });
    const settings = join(memberDir, SETTINGS_FILE);
    if ('problem' in source) {
        return [at(settings, 1, source.problem)];
    }
    const path = resolve(memberDir, source.source);
    let text: string;
    try {
        text = readFileSync(path, 'utf8');
    } catch {
        return [at(settings, 1, `test.routes names ${source.source}, which does not exist`)];
    }
    let routes: Route[];
    try {
        routes = routesOf(text, extname(path) === '.json');
    } catch (error) {
        return [
            at(
                path,
                1,
                `the route source does not parse — ${error instanceof Error ? error.message : String(error)}`,
            ),
        ];
    }
    const reached = readersUnder(join(memberDir, 'specs')).flatMap((file) => reachOfSpec(file));
    return routes
        .filter((route) => !reached.some((reach) => reaches(route, reach)))
        .map((route) =>
            at(
                path,
                route.line,
                `${route.method} ${route.path} is declared and no spec reaches it — send it from a case, or record what the member accepts`,
            ),
        );
}
