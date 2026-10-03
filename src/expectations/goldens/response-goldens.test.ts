import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, inject, onTestFinished, test, vi } from 'vitest';

import { file } from '../../disk/spec-path.js';
import { parseResponseFile, serializeResponseFile } from '../http/http-file.js';
import { ResponseAccessor } from '../http/response.js';
import { deferRewritesTo } from '../in-place/in-place.js';
import { CaptureScope } from '../tokens/capture-scope.js';
import { registerMatchers } from './matchers.js';
import { buildUpdatedResponse, compareResponse } from './response-goldens.js';
import { WHOLE_MATCHER } from './text-assertions.js';

const UUID = '5b3f6e6e-8f5f-4f7e-9c1d-2a6b7c8d9e0f';

const WORKDIR = '/tmp/spec-run-abcdef';

function plainCount(dir: string): ResponseAccessor {
    return new ResponseAccessor(
        { body: '42', headers: { 'content-type': 'text/plain' }, status: 200 },
        dir,
    );
}

function goldenDir(content: string): { dir: string; read: () => string } {
    const dir = mkdtempSync(join(tmpdir(), 'untyped-golden-'));
    onTestFinished(() => {
        rmSync(dir, { force: true, recursive: true });
    });
    mkdirSync(join(dir, '_expected'));
    const path = join(dir, '_expected', 'count.http');
    writeFileSync(path, content);
    return { dir, read: () => readFileSync(path, 'utf8') };
}

type Whole = (expected: unknown, options: unknown, stack: string) => unknown;

type Registered = (expected: unknown, call: { options: unknown; stack: string }) => unknown;

function wholeOf(subject: unknown, negated = false): Whole {
    // oxlint-disable-next-line vitest/valid-expect -- the assertion's matcher is the registered comparison, called below by the name no member access spells
    const assertion = expect(subject);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the matcher is registered under a name no member access spells; reaching it by that name is how a test hands it a stack of its own
    const target = (negated ? assertion.not : assertion) as unknown as Record<string, Registered>;
    return (expected, options, stack) => target[WHOLE_MATCHER]?.(expected, { options, stack });
}

function scratchTest(call: string): { file: string; read: () => string; stack: string } {
    const scratch = mkdtempSync(join(tmpdir(), 'whole-in-place-'));
    const testFile = join(scratch, 'scratch.test.ts');
    writeFileSync(testFile, `test('records', async () => {\n    ${call}\n});\n`);
    // invariant: a scratch test is read back by the test that wrote it: written at once.
    deferRewritesTo(null);
    onTestFinished(() => {
        rmSync(scratch, { force: true, recursive: true });
        deferRewritesTo(() => inject('inPlaceRewrites'));
    });
    return {
        file: testFile,
        read: () => readFileSync(testFile, 'utf8'),
        stack: `Error: toMatch call site\n    at ${testFile}:2:5`,
    };
}

await registerMatchers();

describe('response-goldens', () => {
    test('responseGoldens — response update mode — buildUpdatedResponse (rule `no-volatile-literal`) — writes only headers present in the actual response (intersection)', () => {
        // Given - a previous fixture with a matching placeholder, a stale value, and a header the response no longer sends
        const previous = parseResponseFile(
            'HTTP/1.1 200 OK\ncontent-type: {{string}}\nx-stale: old\nx-gone: bye\n\n{ "ok": true }\n',
            'responses/prev.http',
        );
        const actual = {
            body: { ok: true },
            headers: { 'content-type': 'application/json', 'x-stale': 'new' },
            status: 200,
        };

        // When - update mode rebuilds the fixture
        const updated = buildUpdatedResponse(previous, actual);

        // Then - placeholder preserved, stale value refreshed, absent header dropped
        expect(updated.headers).toStrictEqual({ 'content-type': '{{string}}', 'x-stale': 'new' });
    });

    test('responseGoldens — response update mode — buildUpdatedResponse (rule `no-volatile-literal`) — a fresh fixture records only the content-type header', () => {
        // Given - no previous fixture
        const updated = buildUpdatedResponse(null, {
            body: { id: UUID },
            headers: { 'content-type': 'application/json', 'x-noise': 'zzz' },
            status: 201,
        });

        // Then - status + content-type + body, nothing speculative
        expect(updated.status).toBe('201');
        expect(updated.headers).toStrictEqual({ 'content-type': 'application/json' });
        expect(updated.body).toStrictEqual({ id: UUID });
    });

    test('responseGoldens — response update mode — buildUpdatedResponse (rule `no-volatile-literal`) — preserves a still-matching status placeholder and body placeholders', () => {
        // Given - a previous fixture with tokens everywhere
        const previous = parseResponseFile(
            'HTTP/1.1 {{number}}\n\n{ "id": "{{uuid}}", "name": "STALE" }\n',
            'responses/prev.http',
        );

        // When - update mode rebuilds
        const updated = buildUpdatedResponse(previous, {
            body: { id: UUID, name: 'Alice' },
            headers: {},
            status: 200,
        });

        // Then - matching tokens survive, stale literals are replaced
        expect(updated.status).toBe('{{number}}');
        expect(updated.body).toStrictEqual({ id: '{{uuid}}', name: 'Alice' });
    });

    test('responseGoldens — response update mode — buildUpdatedResponse (rule `no-volatile-literal`) — meta: a freshly updated fixture passes the next comparison run', () => {
        // Given - an update-mode write from a previous fixture (placeholders, stale header value, dropped header), serialized and re-parsed exactly as the matcher does across two runs
        const previous = parseResponseFile(
            'HTTP/1.1 {{number}}\ncontent-type: {{string}}\nx-stale: old\nx-gone: bye\n\n{ "id": "{{uuid}}", "name": "STALE" }\n',
            'responses/prev.http',
        );
        const actual = {
            body: { id: UUID, name: 'Alice' },
            headers: { 'content-type': 'application/json', 'x-stale': 'new' },
            status: 200,
        };
        const written = serializeResponseFile(buildUpdatedResponse(previous, actual));

        // When - the next normal run compares the same actual response
        const reloaded = parseResponseFile(written, 'responses/updated.http');
        const failure = compareResponse('updated.http', reloaded, actual, new CaptureScope());

        // Then - the freshly written fixture matches
        expect(failure).toBeNull();
    });

    test('responseGoldens — response body update mode — workdir substitution (rule `no-volatile-literal`, text/json/http-body parity) — a fresh body substitutes the known cwd for its {{workdir}} token', () => {
        // Given - no previous fixture and a body embedding the run cwd
        const updated = buildUpdatedResponse(
            null,
            { body: { cwd: WORKDIR, log: `wrote ${WORKDIR}/out.txt` }, headers: {}, status: 200 },
            WORKDIR,
        );

        // Then - the body stores tokens, not the run-specific temp path
        expect(updated.body).toStrictEqual({
            cwd: '{{workdir}}',
            log: 'wrote {{workdir}}/out.txt',
        });
    });

    test('responseGoldens — response body update mode — workdir substitution (rule `no-volatile-literal`, text/json/http-body parity) — a previous {{workdir}} placeholder in the body is preserved', () => {
        // Given - a previous fixture that already tokenised the cwd
        const previous = parseResponseFile(
            'HTTP/1.1 200 OK\n\n{ "cwd": "{{workdir}}", "name": "STALE" }\n',
            'responses/prev.http',
        );

        // When - update mode rebuilds against a cwd-bearing response
        const updated = buildUpdatedResponse(
            previous,
            { body: { cwd: WORKDIR, name: 'Alice' }, headers: {}, status: 200 },
            WORKDIR,
        );

        // Then - the token survives, the stale literal refreshes
        expect(updated.body).toStrictEqual({ cwd: '{{workdir}}', name: 'Alice' });
    });

    test('responseGoldens — response body update mode — workdir substitution (rule `no-volatile-literal`, text/json/http-body parity) — meta: a workdir-substituted body passes the next comparison run', () => {
        // Given - an update-mode write serialized and re-parsed as the matcher does
        const actual = { body: { cwd: WORKDIR, name: 'Alice' }, headers: {}, status: 200 };
        const written = serializeResponseFile(buildUpdatedResponse(null, actual, WORKDIR));

        // When - the next normal run compares the same response with a workdir-aware scope
        const reloaded = parseResponseFile(written, 'responses/updated.http');
        const failure = compareResponse(
            'updated.http',
            reloaded,
            actual,
            new CaptureScope(WORKDIR),
        );

        // Then - the freshly written body (holding {{workdir}}) matches
        expect(written).toContain('{{workdir}}');
        expect(failure).toBeNull();
    });

    // RUNTIME one-verb-per-meaning — `toMatch` routes the disk to the golden, and a value to the whole-result comparison or a refusal.
    test('responseGoldens — response comparison — compareResponse — matches status, header subset, and body with tokens', () => {
        // Given - a fixture with placeholders
        const expected = parseResponseFile(
            'HTTP/1.1 200 OK\ncontent-type: {{string}}\n\n{ "id": "{{uuid}}" }\n',
            'responses/ok.http',
        );

        // Then - a conforming response yields no failure
        expect(
            compareResponse(
                'ok.http',
                expected,
                {
                    body: { id: UUID },
                    headers: { 'content-type': 'application/json', 'x-extra': 'ignored' },
                    status: 200,
                },
                new CaptureScope(),
            ),
        ).toBeNull();
    });

    test('responseGoldens — response comparison — compareResponse — reports status, header, and body mismatches distinctly', () => {
        // Given - a strict fixture
        const expected = parseResponseFile(
            'HTTP/1.1 200 OK\nx-req: yes\n\n{ "ok": true }\n',
            'responses/strict.http',
        );
        const scope = new CaptureScope();

        // Then - each failure mode names its section
        expect(
            compareResponse('s.http', expected, { body: {}, headers: {}, status: 500 }, scope),
        ).toContain('status mismatch');
        expect(
            compareResponse('s.http', expected, { body: {}, headers: {}, status: 200 }, scope),
        ).toContain('header mismatch');
        expect(
            compareResponse(
                's.http',
                expected,
                { body: { ok: false }, headers: { 'x-req': 'yes' }, status: 200 },
                scope,
            ),
        ).toContain('s.http');
    });

    test("responseGoldens — a golden that states no content-type reads its body by the actual response's — in place and by file, a bare 42 is the text of a text/plain reply", async () => {
        await registerMatchers();
        // Given - a text/plain "42", and a golden with no content-type on disk
        const golden = goldenDir('HTTP/1.1 200 OK\n\n42\n');

        // Then - both read the golden's 42 as text, and match
        expect(plainCount('/tmp')).toMatch('HTTP/1.1 200 OK\n\n42');
        // checker-disable-next-line named-path-exists -- the golden resolves against the hand-built accessor's scratch directory, not this file's
        expect(plainCount(golden.dir)).toMatch(file('./_expected/count.http'), { frozen: true });
    });

    test("responseGoldens — a golden that states no content-type reads its body by the actual response's — update mode writes a text/plain reply back as its bare text, by file and in place", async () => {
        await registerMatchers();
        // Given - update mode, a stale golden with no content-type on disk, and the same in place
        vi.stubEnv('TEST_UPDATE', '1');
        const golden = goldenDir('HTTP/1.1 200 OK\n\n41\n');
        const scratch = scratchTest(
            String.raw`expect(result.response).toMatch('HTTP/1.1 200 OK\n\n41');`,
        );

        // When - the reply is compared to each
        // checker-disable-next-line named-path-exists -- the golden resolves against the hand-built accessor's scratch directory, not this file's
        expect(plainCount(golden.dir)).toMatch(file('./_expected/count.http'));
        void wholeOf(plainCount('/tmp'))('HTTP/1.1 200 OK\n\n41', undefined, scratch.stack);

        // Then - both hold the text 42, never the JSON string "42"
        expect(golden.read()).toBe('HTTP/1.1 200 OK\n\n42\n');
        expect(scratch.read()).toContain(
            'toMatch(`\n        HTTP/1.1 200 OK\n\n        42\n    `);',
        );
    });

    test("responseGoldens — a golden that states no content-type reads its body by the actual response's — update mode reads the golden it rewrites as text too: a token in a text/plain body is kept", async () => {
        await registerMatchers();
        // Given - update mode, a text/plain reply that looks like JSON, and a golden with no content-type holding a token
        vi.stubEnv('TEST_UPDATE', '1');
        const golden = goldenDir('HTTP/1.1 200 OK\n\n["{{int}}"]\n');
        const reply = new ResponseAccessor(
            { body: '["7"]', headers: { 'content-type': 'text/plain' }, status: 200 },
            golden.dir,
        );

        // When - the golden is re-recorded
        // checker-disable-next-line named-path-exists -- the golden resolves against the hand-built accessor's scratch directory, not this file's
        expect(reply).toMatch(file('./_expected/count.http'));

        // Then - the text still matched its token, so the token stays
        expect(golden.read()).toBe('HTTP/1.1 200 OK\n\n["{{int}}"]\n');
    });
});
