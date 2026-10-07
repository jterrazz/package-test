import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { dedent } from '../../../../lint/kit/project/dedent.js';
import { defineAction } from '../../../chain/action.js';
import type { SliceReader } from '../../../chain/action.js';
import type { ChainSignature, MatrixRow, Run } from '../../../chain/capability.js';
import { headers } from '../../../chain/context/headers.capability.js';
import { refusal } from '../../../chain/refusals/refusal.js';
import { isDiskDirectory, isDiskFile, requireDiskFile } from '../../../disk/spec-path.js';
import type { DiskFile } from '../../../disk/spec-path.js';
import type { ServerPort } from '../server/server.port.js';
import { HttpResult } from './http.result.js';
import { parseRequestFile } from './request-file.js';
import type { ParsedRequestFile } from './request-file.js';
import { params, routeRequest } from './route.js';
import type { RouteArguments, RouteOptionsAny } from './route.js';

type Needs = { server: ServerPort };

type Sent = {
    body?: unknown;
    headers?: Record<string, string>;
    method: string;
    path: string;
    template?: string | undefined;
};

const ACCESSORS: readonly MatrixRow[] = [
    { group: 'Result accessor', name: '.response', probe: 'result.response' },
    { group: 'Result accessor', name: '.status', probe: 'result.status' },
    { group: 'Result accessor', member: 'table', name: '.table()', probe: 'result.table(' },
    { group: 'Result accessor', member: 'file', name: '.file()', probe: '.file(' },
    { group: 'Result accessor', member: 'directory', name: '.directory()', probe: '.directory(' },
];

const NO_WORKDIR = { workDir: null } as const;

// invariant: a `.json` file is sent as the value it holds, any other as its text.
function bodyOf(body: DiskFile, testDir: string): unknown {
    const content = readFileSync(resolve(testDir, body.path), 'utf8');
    return body.path.endsWith('.json') ? JSON.parse(content) : content;
}

function writtenRequest(source: DiskFile | string, testDir: string): ParsedRequestFile {
    return typeof source === 'string'
        ? parseRequestFile(dedent(source), 'the request in place')
        : parseRequestFile(readFileSync(resolve(testDir, source.path), 'utf8'), source.path);
}

async function send(
    { body, headers: written, method, path, template }: Sent,
    read: SliceReader,
    { server }: Needs,
    { config, testDir }: Run,
): Promise<HttpResult> {
    if (isDiskDirectory(body)) {
        throw new TypeError(
            refusal('disk-named-by-relative-path-at-runtime', {
                fix: `name one file: .${method.toLowerCase()}(${JSON.stringify(path)}, file('./__requests__/body.json'))`,
                found: `.${method.toLowerCase()}(${JSON.stringify(path)}, directory(${JSON.stringify(body.path)})), a directory where the body is one file`,
            }),
        );
    }
    const carried = { ...written, ...read(headers) };
    const response = await server.request(
        method,
        path,
        isDiskFile(body) ? bodyOf(body, testDir) : body,
        { headers: Object.keys(carried).length > 0 ? carried : undefined, template },
    );
    return new HttpResult({ config, response, testDir });
}

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
        /** Send a complete request: its `.http` text written in the test, or `file('./__requests__/<name>.http')`. */
        request: (source: DiskFile<'.http'> | string) => Promise<HttpResult>;
    };
};

/** First line `METHOD /path`, then headers until a blank line, then the body. */
export const request = defineAction<
    'request',
    [source: DiskFile<'.http'> | string],
    HttpResult,
    RequestSignature,
    Needs
>({
    accessors: ACCESSORS,
    name: 'request',
    perform: async ([source], read, adapters, run) =>
        await send(writtenRequest(source, run.testDir), read, adapters, run),
    prepare: ([source]) => {
        if (typeof source !== 'string') {
            requireDiskFile('request', source, '.http');
        }
        return NO_WORKDIR;
    },
    row: { group: 'Terminal action', name: '.request()', probe: '.request(file(' },
});

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
    perform: async ([path, options], read, adapters, run) =>
        await send({ method: 'GET', ...routeRequest('GET', path, options) }, read, adapters, run),
    prepare: ([path, options]) => {
        routeRequest('GET', path, options);
        return NO_WORKDIR;
    },
    row: { group: 'Terminal action', name: '.get()', probe: ".get('/" },
});

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
    perform: async ([path, body, options], read, adapters, run) =>
        await send(
            { body, method: 'POST', ...routeRequest('POST', path, options) },
            read,
            adapters,
            run,
        ),
    prepare: ([path, _body, options]) => {
        routeRequest('POST', path, options);
        return NO_WORKDIR;
    },
    row: { group: 'Terminal action', name: '.post()', probe: ".post('" },
});

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
    perform: async ([path, body, options], read, adapters, run) =>
        await send(
            { body, method: 'PUT', ...routeRequest('PUT', path, options) },
            read,
            adapters,
            run,
        ),
    prepare: ([path, _body, options]) => {
        routeRequest('PUT', path, options);
        return NO_WORKDIR;
    },
    row: { group: 'Terminal action', name: '.put()', probe: ".put('" },
});

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
    perform: async ([path, options], read, adapters, run) =>
        await send(
            { method: 'DELETE', ...routeRequest('DELETE', path, options) },
            read,
            adapters,
            run,
        ),
    prepare: ([path, options]) => {
        routeRequest('DELETE', path, options);
        return NO_WORKDIR;
    },
    row: { group: 'Terminal action', name: '.delete()', probe: ".delete('" },
});
