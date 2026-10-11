import { http } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli as backendCli } from '../backend-cli.specification.js';
import { cli } from '../cli.specification.js';

describe('backend', () => {
    test('a binary that reports to a configurable origin is served the stubs the chain declared', async () => {
        // Given - the binary pointed at the stub backend through INGEST_URL, and a stub for its report
        const result = await backendCli
            .intercept(http.post('/ingest'), http.json({ accepted: true }, { status: 202 }))
            .exec('ingest');

        // Then - the binary reached the stub and read its status
        expect(result.stdout.text).toBe('ingest status 202\n');
    });

    test('a request no stub of the chain matches fails the run, naming it', async () => {
        // Given - a stub for another path, so the report matches none
        const run = backendCli
            .intercept(http.get('/elsewhere'), http.json({ ok: true }))
            .exec('ingest');

        // Then - the run is refused with the unmatched request named
        await expect(run).rejects.toThrow('POST /ingest');
    });

    test('a runner that declared no backend refuses a stub as it is stated, naming the option', () => {
        // Given - the plain runner of the specimen, which declares no backend
        // Then - the call is refused before any run
        expect(() => cli.intercept(http.post('/ingest'), http.json({}))).toThrow(
            [
                'found: .intercept(), and this runner has no declared backend',
                'why: A site or an app is served its stubs by a declared stub backend, the URL it reads in place of its API.',
                "fix: add `backend` to the specification options: specification.cli(bin, { …, backend: { env: 'API_URL' } })",
                'read: docs/guides/cli-specs.md#declared-backend',
            ].join('\n'),
        );
    });
});
