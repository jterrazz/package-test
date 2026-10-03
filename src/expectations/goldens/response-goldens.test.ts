import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { file } from '../../disk/spec-path.js';
import { parseResponseFile, serializeResponseFile } from '../http/http-file.js';
import { ResponseAccessor } from '../http/response.js';
import { CaptureScope } from '../tokens/capture-scope.js';
import { registerMatchers } from './matchers.js';
import {
    goldenDir,
    plainCount,
    scratchTest,
    UUID,
    wholeOf,
    WORKDIR,
} from './response-goldens.fixtures.js';
import { buildUpdatedResponse, compareResponse, matchResponseFile } from './response-goldens.js';

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

        // Then - matching tokens survive, stale literals are replaced, and a reply with no body or a null one records none
        expect([
            updated.status,
            updated.body,
            buildUpdatedResponse(previous, { body: undefined, headers: {}, status: 204 }).hasBody,
            buildUpdatedResponse(previous, { body: null, headers: {}, status: 204 }).hasBody,
        ]).toStrictEqual(['{{number}}', { id: '{{uuid}}', name: 'Alice' }, false, false]);
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
    test('responseGoldens — response comparison — compareResponse — a status, the listed headers and the body each judged, the first that differs named whole', () => {
        // Given - a golden with a status token, a header token, a header required present, and a body token
        const expected = parseResponseFile(
            'HTTP/1.1 {{any}}\ncontent-type: {{string}}\nx-req: {{any}}\n\n{ "id": "{{uuid}}" }\n',
            'r.http',
        );
        const strict = parseResponseFile('HTTP/1.1 201 Created\n\n', 's.http');
        const json = { 'content-type': 'application/json', 'x-req': 'yes' };
        const compare = (
            golden: typeof expected,
            actual: { body: unknown; headers: Record<string, string>; status: number },
        ): null | string => compareResponse('r.http', golden, actual, new CaptureScope());

        // Then - nothing when it all conforms, or the section that differs
        expect([
            compare(expected, {
                body: { id: UUID },
                headers: { ...json, 'x-extra': 'ignored' },
                status: 200,
            }),
            compare(strict, { body: { anything: true }, headers: {}, status: 201 }),
            compare(strict, { body: null, headers: {}, status: 200 }),
            compare(expected, {
                body: { id: UUID },
                headers: { 'content-type': 'application/json' },
                status: 200,
            }),
            compare(expected, { body: { id: 'no' }, headers: json, status: 200 })?.split('\n')[0],
        ]).toStrictEqual([
            null,
            null,
            'Response status mismatch (r.http)\n  expected: 201\n  received: 200',
            'Response header mismatch (r.http)\n  header: x-req\n  expected: {{any}}\n  received: (absent)',
            'Response mismatch (r.http)',
        ]);
    });

    test('responseGoldens — matchResponseFile — compares a response to its golden, names a missing one, writes it in update mode, and never a frozen one', () => {
        // Given - a reply, its golden, and names of no golden
        const { dir } = goldenDir('HTTP/1.1 200 OK\n\n42\n');
        const missing = (name: string): string => join(dir, '_expected', name);
        writeFileSync(missing('wrong.http'), 'HTTP/1.1 200 OK\n\n43\n');

        // When - matched, then in update mode
        const verdicts = [
            matchResponseFile(plainCount(dir), './_expected/count.http', false),
            matchResponseFile(plainCount(dir), './_expected/wrong.http', false),
            matchResponseFile(plainCount(dir), './_expected/none.http', true),
            matchResponseFile(plainCount(dir), './_expected/none.http', false),
        ].map((result) => [result.pass, result.message()]);
        vi.stubEnv('TEST_UPDATE', '1');
        const frozen = matchResponseFile(plainCount(dir), './_expected/frozen.http', true);
        const written = matchResponseFile(plainCount(dir), './_expected/fresh.http', false);

        // Then - each verdict, the fresh golden written as the reply reads, the frozen one not
        expect([
            verdicts,
            frozen.pass,
            [written.pass, written.message()],
            readFileSync(missing('fresh.http'), 'utf8'),
            existsSync(missing('frozen.http')),
        ]).toStrictEqual([
            [
                [true, 'expected response not to match ./_expected/count.http'],
                [false, expect.stringContaining('Response mismatch (./_expected/wrong.http)')],
                [
                    false,
                    `Response fixture "./_expected/none.http" does not exist at ${missing('none.http')}.\nThis golden is \`{ frozen }\`: update mode never writes it. Write the file by hand, or drop \`{ frozen }\` for one TEST_UPDATE=1 run and put it back.`,
                ],
                [
                    false,
                    `Response fixture "./_expected/none.http" does not exist at ${missing('none.http')}.\nRun with TEST_UPDATE=1 (or vitest -u) to create it.`,
                ],
            ],
            false,
            [true, 'updated ./_expected/fresh.http'],
            'HTTP/1.1 200 OK\ncontent-type: text/plain\n\n42\n',
            false,
        ]);
        expect(() => matchResponseFile(plainCount(dir), './_expected/count', false)).toThrow(
            'on response, a golden path with no extension',
        );
        expect(() => matchResponseFile(plainCount(dir), '/abs/count.http', false)).toThrow(
            'toMatch("/abs/count.http")',
        );
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
