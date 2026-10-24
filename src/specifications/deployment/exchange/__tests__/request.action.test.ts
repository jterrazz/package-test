import { describe, expect, test } from 'vitest';

import { EMPTY_STATE, readerOf } from '../../../../chain/state.js';
import { directory, file } from '../../../../disk/spec-path.js';
import { request } from '../request.action.js';

const CONFIG = {
    baseUrl: 'https://site.test',
    ca: undefined,
    insecure: false,
    recording: { bodyKeptAbsent: true, headers: [] },
    timeout: 1000,
};

async function messageOf(work: () => unknown): Promise<string> {
    try {
        await work();
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

describe('request.action', () => {
    test('request.action — .request() — a complete request is a .http file, or its text written in place', async () => {
        // Given - a request file, a directory, and a file of another extension
        const http = file('./__requests__/probe.http');
        const folder = directory('./__requests__/');
        const json = file('./__requests__/probe.json');
        const prepared = await Promise.all([
            messageOf(async () => await request.prepare?.([http], readerOf(EMPTY_STATE))),
            // @ts-expect-error -- a directory where one file is read: the type refuses it, the run refuses an untyped caller
            messageOf(async () => await request.prepare?.([folder], readerOf(EMPTY_STATE))),
            // @ts-expect-error -- a file of another extension: the type refuses it, the run refuses an untyped caller
            messageOf(async () => await request.prepare?.([json], readerOf(EMPTY_STATE))),
        ]);

        // Then - the file accepted, the two others refused as the disk is refused
        expect(prepared.map((message) => message.split('\n')[0])).toStrictEqual([
            '',
            'found: request(directory("./__requests__/")), a directory where one file is read',
            'found: request(file("./__requests__/probe.json")), a file not ending in .http',
        ]);
    });

    test('request.action — .request() — a request written in place that opens on no request line is refused by its name, before any exchange', async () => {
        // Given - a request in place whose first line names no method
        const refused = await messageOf(
            async () =>
                await request.perform(
                    ['health check'],
                    readerOf(EMPTY_STATE),
                    {},
                    {
                        config: CONFIG,
                        testDir: import.meta.dirname,
                        workDir: null,
                    },
                ),
        );

        // Then - the request is named as written in the test
        expect(refused.split('\n')[0]).toBe(
            'found: the request in place: the first line is "health check"',
        );
    });
});
