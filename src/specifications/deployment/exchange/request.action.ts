import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { dedent } from '../../../../lint/kit/project/dedent.js';
import { defineAction } from '../../../chain/action.js';
import type { SliceReader } from '../../../chain/action.js';
import type { ChainSignature, Run } from '../../../chain/capability.js';
import { headers } from '../../../chain/context/headers.capability.js';
import { requireDiskFile } from '../../../disk/spec-path.js';
import type { DiskFile } from '../../../disk/spec-path.js';
import { bodyKind, readBody } from '../../../expectations/http/http-file.js';
import { parseRequestFile } from '../../../expectations/http/request-file.js';
import type { ServerResponse } from '../../../expectations/http/response.js';
import type { DeploymentConfig } from '../deployment.handle.js';
import { connect } from './connect.capability.js';
import { EXCHANGE_RESULT_ROWS, ExchangeResult } from './exchange.result.js';
import { connectAddress, targetUrl } from './target.js';
import { exchange } from './transport.js';
import type { Answer } from './transport.js';

type Written = {
    body?: string | undefined;
    headers: Readonly<Record<string, string>>;
    method: string;
    target: string;
};

const NO_WORKDIR = { workDir: null } as const;

// invariant: a binary body is not read, as an api response's is not: a golden states its status and headers.
function responseOf(answer: Answer): ServerResponse {
    if (answer.unreachable !== undefined) {
        return { body: null, headers: {}, status: 0, unreachable: answer.unreachable };
    }
    const contentType = answer.headers['content-type'];
    return {
        body:
            bodyKind(contentType) === 'binary'
                ? null
                : (readBody(answer.text, contentType) ?? null),
        headers: answer.headers,
        status: answer.status,
    };
}

async function send(
    written: Written,
    read: SliceReader,
    { config, testDir }: Run<DeploymentConfig>,
): Promise<ExchangeResult> {
    const url = targetUrl(written.target, config.baseUrl);
    const address = read(connect);
    const answer = await exchange(
        {
            body: written.body,
            headers: { ...written.headers, ...read(headers) },
            method: written.method,
            url,
        },
        {
            ca: config.ca,
            connect: address === null ? undefined : connectAddress(address, url),
            insecure: config.insecure,
            timeout: config.timeout,
        },
    );
    return new ExchangeResult({
        config,
        recording: config.recording,
        response: responseOf(answer),
        testDir,
        tls: answer.tls,
    });
}

function writtenRequest(source: DiskFile | string, testDir: string): Written {
    const parsed =
        typeof source === 'string'
            ? parseRequestFile(dedent(source), 'the request in place')
            : parseRequestFile(readFileSync(resolve(testDir, source.path), 'utf8'), source.path);
    return {
        body: parsed.body,
        headers: parsed.headers,
        method: parsed.method,
        target: parsed.path,
    };
}

export type ExchangeSignature = ChainSignature & {
    readonly chain: {
        /** Send a GET to a URL, written whole or as a path from the specification's `url`, and resolve with what came back. */
        get: (target: string) => Promise<ExchangeResult>;
        /** Send a complete request: its `.http` text written in the test, or `file('./__requests__/<name>.http')`; its first line names the URL whole or a path. */
        request: (source: DiskFile<'.http'> | string) => Promise<ExchangeResult>;
    };
};

/** A redirect is the answer, never followed; an exchange that never answered is the answer too, `unreachable: <reason>`. */
export const get = defineAction<
    'get',
    [target: string],
    ExchangeResult,
    ExchangeSignature,
    Record<never, never>,
    DeploymentConfig
>({
    accessors: EXCHANGE_RESULT_ROWS,
    name: 'get',
    perform: async ([target], read, _adapters, run) =>
        // Stryker disable next-line StringLiteral: node sends a GET for a method left empty, so no exchange tells the two apart
        await send({ headers: {}, method: 'GET', target }, read, run),
    row: { group: 'Terminal action', name: '.get()', probe: ".get('/" },
});

/** First line `METHOD <url or path>`, then headers until a blank line, then the body. */
export const request = defineAction<
    'request',
    [source: DiskFile<'.http'> | string],
    ExchangeResult,
    ExchangeSignature,
    Record<never, never>,
    DeploymentConfig
>({
    accessors: EXCHANGE_RESULT_ROWS,
    name: 'request',
    perform: async ([source], read, _adapters, run) =>
        await send(writtenRequest(source, run.testDir), read, run),
    prepare: ([source]) => {
        if (typeof source !== 'string') {
            requireDiskFile('request', source, '.http');
        }
        return NO_WORKDIR;
    },
    row: { group: 'Terminal action', name: '.request()', probe: '.request(file(' },
});
