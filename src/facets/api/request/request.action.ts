import { readFileSync } from 'node:fs';

import { dedent } from '../../../expectations/text/dedent.js';
import { defineAction } from '../../../kernel/chain/action.js';
import type { SliceReader } from '../../../kernel/chain/action.js';
import type { ChainSignature, MatrixRow, Run } from '../../../kernel/chain/capability.js';
import { headers } from '../../../kernel/context/headers.capability.js';
import { resolveSpecPath } from '../../../kernel/files/resolve.js';
import { isDiskDirectory, isDiskFile, requireDiskFile } from '../../../kernel/files/spec-path.js';
import type { DiskFile } from '../../../kernel/files/spec-path.js';
import type { ServerPort } from '../server/server.port.js';
import { HttpResult } from './http.result.js';
import { parseRequestFile } from './request-file.js';
import { params, routeRequest } from './route.js';
import type { RouteArguments, RouteOptionsAny } from './route.js';

/** The app a request is sent to — the one its constructor was handed. */
type Needs = { server: ServerPort };

/** One request, as the chain sends it. */
type Sent = {
    /**
     * The body: a value (objects JSON-serialised, strings sent raw), or a
     * `file()` whose content is sent — parsed first when it is `.json`.
     */
    body?: unknown;
    method: string;
    path: string;
    /** A complete request to send: a `.http` file, or its text written in the test. */
    request?: DiskFile | string | undefined;
    /** The route template the path was written as, when the test wrote one. */
    template?: string | undefined;
};

/** What every request hands back: the exchange, and the databases it left. */
const ACCESSORS: readonly MatrixRow[] = [
    { group: 'Result accessor', name: '.response', probe: 'result.response' },
    { group: 'Result accessor', name: '.status', probe: 'result.status' },
    { group: 'Result accessor', member: 'table', name: '.table()', probe: 'result.table(' },
    { group: 'Result accessor', member: 'file', name: '.file()', probe: '.file(' },
    { group: 'Result accessor', member: 'directory', name: '.directory()', probe: '.directory(' },
];

/** Nothing a request runs in: the app answers in this process. */
const NO_WORKDIR = { workDir: null } as const;

/**
 * Send one request to the app: a `file()` body read, a complete request
 * parsed, the chain's headers merged over the request's own — the chain wins.
 */
async function send(
    sent: Sent,
    read: SliceReader,
    { server }: Needs,
    { config, testDir }: Run,
): Promise<HttpResult> {
    let { body, method, path } = sent;
    let written: Record<string, string> | undefined;
    if (isDiskDirectory(body)) {
        throw new TypeError(
            `.${method.toLowerCase()}(${JSON.stringify(path)}, directory(${JSON.stringify(body.path)})): a body is one file — name it with file().`,
        );
    }
    if (isDiskFile(body)) {
        const content = readFileSync(resolveSpecPath('body', body.path, testDir), 'utf8');
        body = body.path.endsWith('.json') ? JSON.parse(content) : content;
    }
    if (sent.request !== undefined) {
        const parsed =
            typeof sent.request === 'string'
                ? parseRequestFile(dedent(sent.request), 'the request in place')
                : parseRequestFile(
                      readFileSync(resolveSpecPath('request', sent.request.path, testDir), 'utf8'),
                      sent.request.path,
                  );
        ({ body, method, path } = parsed);
        written = parsed.headers;
    }
    const carried = { ...written, ...read(headers) };
    const response = await server.request(method, path, body, {
        headers: Object.keys(carried).length > 0 ? carried : undefined,
        template: sent.template,
    });
    return new HttpResult({ config, response, testDir });
}

/** What the request family puts on a chain: one HTTP exchange each. */
export type RequestSignature = ChainSignature & {
    readonly chain: {
        /** Send a DELETE request to a route — `(template, { params })` — and resolve with the result. */
        delete: <Path extends string>(
            path: Path,
            ...options: RouteArguments<Path>
        ) => Promise<HttpResult>;
        /** Send a GET request to a route — `(template, { params })` — and resolve with the result. */
        get: <Path extends string>(
            path: Path,
            ...options: RouteArguments<Path>
        ) => Promise<HttpResult>;
        /** Send a POST request — the body a value or a `file()` — and resolve with the result. */
        post: <Path extends string>(
            path: Path,
            body?: unknown,
            ...options: RouteArguments<Path>
        ) => Promise<HttpResult>;
        /** Send a PUT request — the body a value or a `file()` — and resolve with the result. */
        put: <Path extends string>(
            path: Path,
            body?: unknown,
            ...options: RouteArguments<Path>
        ) => Promise<HttpResult>;
        /** Send a complete request: its `.http` text written in the test, or `file('./requests/<name>.http')`. */
        request: (source: DiskFile<'.http'> | string) => Promise<HttpResult>;
    };
};

/**
 * `.request(source)`: send a complete request — first line `METHOD /path`,
 * then headers until a blank line, then the body — written in the test
 * (dedented, as a value in place is), or in a `.http` file several tests share.
 */
export const request = defineAction<
    'request',
    [source: DiskFile<'.http'> | string],
    HttpResult,
    RequestSignature,
    Needs
>({
    accessors: ACCESSORS,
    name: 'request',
    perform: async ([source], read, engines, run) =>
        await send(
            {
                method: '',
                path: '',
                request:
                    typeof source === 'string'
                        ? source
                        : requireDiskFile('request', source, '.http'),
            },
            read,
            engines,
            run,
        ),
    prepare: ([source]) => {
        if (typeof source !== 'string') {
            requireDiskFile('request', source, '.http');
        }
        return NO_WORKDIR;
    },
    row: { group: 'Terminal action', name: '.request()', probe: '.request(file(' },
});

/** `.get(template, { params })`: send a GET to the route, its parameters filled. */
export const get = defineAction<
    'get',
    [path: string, options?: RouteOptionsAny],
    HttpResult,
    RequestSignature,
    Needs
>({
    accessors: ACCESSORS,
    name: 'get',
    options: [params],
    perform: async ([path, options], read, engines, run) =>
        await send({ method: 'GET', ...routeRequest('GET', path, options) }, read, engines, run),
    prepare: ([path, options]) => {
        routeRequest('GET', path, options);
        return NO_WORKDIR;
    },
    row: { group: 'Terminal action', name: '.get()', probe: ".get('/" },
});

/** `.post(template, body, { params })`: send a POST — the body a value or a `file()`. */
export const post = defineAction<
    'post',
    [path: string, body?: unknown, options?: RouteOptionsAny],
    HttpResult,
    RequestSignature,
    Needs
>({
    accessors: ACCESSORS,
    name: 'post',
    options: [params],
    perform: async ([path, body, options], read, engines, run) =>
        await send(
            { body, method: 'POST', ...routeRequest('POST', path, options) },
            read,
            engines,
            run,
        ),
    prepare: ([path, _body, options]) => {
        routeRequest('POST', path, options);
        return NO_WORKDIR;
    },
    row: { group: 'Terminal action', name: '.post()', probe: ".post('" },
});

/** `.put(template, body, { params })`: send a PUT — the body a value or a `file()`. */
export const put = defineAction<
    'put',
    [path: string, body?: unknown, options?: RouteOptionsAny],
    HttpResult,
    RequestSignature,
    Needs
>({
    accessors: ACCESSORS,
    name: 'put',
    options: [params],
    perform: async ([path, body, options], read, engines, run) =>
        await send(
            { body, method: 'PUT', ...routeRequest('PUT', path, options) },
            read,
            engines,
            run,
        ),
    prepare: ([path, _body, options]) => {
        routeRequest('PUT', path, options);
        return NO_WORKDIR;
    },
    row: { group: 'Terminal action', name: '.put()', probe: ".put('" },
});

/** `.delete(template, { params })`: send a DELETE to the route, its parameters filled. */
export const del = defineAction<
    'delete',
    [path: string, options?: RouteOptionsAny],
    HttpResult,
    RequestSignature,
    Needs
>({
    accessors: ACCESSORS,
    name: 'delete',
    options: [params],
    perform: async ([path, options], read, engines, run) =>
        await send(
            { method: 'DELETE', ...routeRequest('DELETE', path, options) },
            read,
            engines,
            run,
        ),
    prepare: ([path, options]) => {
        routeRequest('DELETE', path, options);
        return NO_WORKDIR;
    },
    row: { group: 'Terminal action', name: '.delete()', probe: ".delete('" },
});
