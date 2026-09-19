import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { DirectoryAccessor } from '../specification/facets/_common/result/directory.js';
import { FilesystemAccessor } from '../specification/facets/_common/result/filesystem.js';
import { JsonAccessor } from '../specification/facets/_common/result/json.js';
import { ResponseAccessor } from '../specification/facets/_common/result/response.js';
import { TableAccessor } from '../specification/facets/_common/result/table.js';
import { TextAccessor } from '../specification/facets/_common/result/text.js';
import { parseResponseFile, serializeResponseFile } from '../specification/http-files/http-file.js';
import { CaptureScope } from '../specification/matching/match.js';
import { buildUpdatedResponse, compareResponse, registerMatchers } from './matchers.js';

const UUID = '5b3f6e6e-8f5f-4f7e-9c1d-2a6b7c8d9e0f';

describe('toMatch — native string behavior preserved (D3)', () => {
    // The custom matcher overrides vitest-native `toMatch`; for plain strings
    // It must delegate to native substring / regexp semantics.
    beforeAll(async () => {
        await registerMatchers();
    });

    test('a plain string still matches a regexp', () => {
        // Given - a plain string subject (not an accessor)
        // Then - native regexp semantics survive the override
        expect('abc').toMatch(/b/u);
        expect('abc').not.toMatch(/z/u);
    });

    test('a plain string still matches a substring', () => {
        // Given - a plain string subject
        // Then - native substring semantics survive the override
        expect('hello world').toMatch('world');
        expect('hello world').not.toMatch('nope');
    });
});

describe('response update mode — buildUpdatedResponse (CONVENTIONS D5)', () => {
    test('writes only headers present in the actual response (intersection)', () => {
        // Given - a previous fixture with a matching placeholder, a stale
        // Value, and a header the response no longer sends
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

    test('a fresh fixture records only the content-type header', () => {
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

    test('preserves a still-matching status placeholder and body placeholders', () => {
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

    test('meta: a freshly updated fixture passes the next comparison run', () => {
        // Given - an update-mode write from a previous fixture (placeholders,
        // Stale header value, dropped header), serialized and re-parsed
        // Exactly as the matcher does across two runs
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
});

describe('response body update mode — workdir substitution (CONVENTIONS D5, text/json/http-body parity)', () => {
    const WORKDIR = '/tmp/spec-run-abcdef';

    test('a fresh body substitutes the known cwd for its {{workdir}} token', () => {
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

    test('a previous {{workdir}} placeholder in the body is preserved', () => {
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

    test('meta: a workdir-substituted body passes the next comparison run', () => {
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
});

describe('toMatch — accessor subjects reject a regex argument (runtime guard, D14)', () => {
    beforeAll(async () => {
        await registerMatchers();
    });

    const subjects: [string, () => unknown][] = [
        ['stream', () => new TextAccessor('out', 'stdout', '/tmp')],
        ['json', () => new JsonAccessor('{}', '/tmp')],
        ['response', () => new ResponseAccessor({ body: {}, headers: {}, status: 200 }, '/tmp')],
        ['filesystem', () => new FilesystemAccessor('/tmp', '/tmp')],
        ['directory', () => new DirectoryAccessor('/tmp', '/tmp')],
    ];

    for (const [kind, make] of subjects) {
        test(`a ${kind} subject throws immediately with the fixture-name guidance`, () => {
            // Given - an accessor subject and the instinctive (wrong) regex argument
            const subject = make();

            // Then - the throw names the subject kind, the rule, and the escape hatch
            expect(() => {
                expect(subject).toMatch(/re/u);
            }).toThrow(kind);
            expect(() => {
                expect(subject).toMatch(/re/u);
            }).toThrow('toMatch on accessors takes a fixture name (extension included)');
            expect(() => {
                expect(subject).toMatch(/re/u);
            }).toThrow('use expect(x.text).toMatch(/re/) for regex matching');
        });
    }

    test('a non-string, non-regex argument is rejected too (defensive)', () => {
        // Given - a stream subject and a numeric argument
        const subject = new TextAccessor('out', 'stdout', '/tmp');

        // Then - the guard still fires with the fixture-name guidance
        expect(() => {
            expect(subject).toMatch(42 as unknown as string);
        }).toThrow('toMatch on accessors takes a fixture name (extension included)');
    });
});

describe('frozen fixtures are never rewritten under TEST_UPDATE (per-subject write gate, D13)', () => {
    // The stream subject is covered end-to-end in specs/cli/assertions; these
    // Unit tests pin the SAME write gate for the json, response, and tree
    // Subjects by stubbing TEST_UPDATE=1 and asserting the fixture on disk is
    // Never created/overwritten when { frozen: true } is set — the invariant
    // That keeps a deliberately-wrong negative fixture survivable across
    // Update runs.
    let savedTestUpdate: string | undefined;
    let scratch: string;

    beforeAll(async () => {
        await registerMatchers();
    });

    beforeEach(() => {
        // Given - update mode ON and a fresh isolated scratch test-dir
        savedTestUpdate = process.env.TEST_UPDATE;
        process.env.TEST_UPDATE = '1';
        scratch = mkdtempSync(join(tmpdir(), 'frozen-gate-'));
    });

    afterEach(() => {
        if (savedTestUpdate === undefined) {
            delete process.env.TEST_UPDATE;
        } else {
            process.env.TEST_UPDATE = savedTestUpdate;
        }
        rmSync(scratch, { force: true, recursive: true });
    });

    test('json: a frozen missing fixture throws instead of being written', () => {
        // Given - a json subject and a fixture name that does not exist on disk
        const accessor = new JsonAccessor('{ "id": 1 }', scratch);
        const fixturePath = resolve(scratch, '_expected', 'frozen.json');

        // Then - update mode is bypassed: it throws the does-not-exist error, no write
        expect(() => {
            expect(accessor).toMatch('frozen.json', { frozen: true });
        }).toThrow(/does not exist[\s\S]*TEST_UPDATE=1/u);
        expect(existsSync(fixturePath)).toBeFalsy();
    });

    test('json: a frozen wrong fixture keeps its content and throws its diff', () => {
        // Given - a deliberately-wrong committed json fixture
        const fixturePath = resolve(scratch, '_expected', 'wrong.json');
        mkdirSync(resolve(scratch, '_expected'), { recursive: true });
        writeFileSync(fixturePath, '{\n    "id": 999\n}\n');
        const accessor = new JsonAccessor('{ "id": 1 }', scratch);

        // Then - frozen mismatch still throws and never overwrites
        expect(() => {
            expect(accessor).toMatch('wrong.json', { frozen: true });
        }).toThrow();
        expect(readFileSync(fixturePath, 'utf8')).toBe('{\n    "id": 999\n}\n');
    });

    test('json: without frozen, update mode writes the fixture (control)', () => {
        // Given - the same missing fixture, but NOT frozen
        const accessor = new JsonAccessor('{ "id": 1 }', scratch);
        const fixturePath = resolve(scratch, '_expected', 'written.json');

        // Then - update mode writes it and passes
        expect(accessor).toMatch('written.json');
        expect(existsSync(fixturePath)).toBeTruthy();
    });

    test('response: a frozen missing fixture throws instead of being written', () => {
        // Given - a response subject and a missing fixture
        const accessor = new ResponseAccessor(
            { body: { ok: true }, headers: { 'content-type': 'application/json' }, status: 200 },
            scratch,
        );
        const fixturePath = resolve(scratch, '_expected', 'frozen.http');

        // Then - frozen bypasses the write, throwing the does-not-exist error
        expect(() => {
            expect(accessor).toMatch('frozen.http', { frozen: true });
        }).toThrow(/does not exist[\s\S]*TEST_UPDATE=1/u);
        expect(existsSync(fixturePath)).toBeFalsy();
    });

    test('response: without frozen, update mode writes the fixture (control)', () => {
        // Given - the same missing fixture, not frozen
        const accessor = new ResponseAccessor(
            { body: { ok: true }, headers: { 'content-type': 'application/json' }, status: 200 },
            scratch,
        );
        const fixturePath = resolve(scratch, '_expected', 'written.http');

        // Then - update mode writes and passes
        expect(accessor).toMatch('written.http');
        expect(existsSync(fixturePath)).toBeTruthy();
    });

    test('tree: a frozen missing fixture throws instead of being written', async () => {
        // Given - an actual output tree and a directory fixture that does not exist
        const actualRoot = resolve(scratch, 'actual');
        mkdirSync(actualRoot, { recursive: true });
        writeFileSync(resolve(actualRoot, 'file.txt'), 'hello\n');
        const accessor = new DirectoryAccessor(actualRoot, scratch);
        const fixtureDir = resolve(scratch, '_expected', 'frozen-tree');

        // Then - frozen bypasses the write (async matcher rejects), nothing created
        await expect(expect(accessor).toMatch('frozen-tree', { frozen: true })).rejects.toThrow(
            /does not exist[\s\S]*TEST_UPDATE=1/u,
        );
        expect(existsSync(fixtureDir)).toBeFalsy();
    });

    test('tree: without frozen, update mode writes the fixture tree (control)', async () => {
        // Given - the same actual tree and a missing fixture, not frozen
        const actualRoot = resolve(scratch, 'actual');
        mkdirSync(actualRoot, { recursive: true });
        writeFileSync(resolve(actualRoot, 'file.txt'), 'hello\n');
        const accessor = new DirectoryAccessor(actualRoot, scratch);
        const fixtureFile = resolve(scratch, '_expected', 'written-tree', 'file.txt');

        // Then - update mode copies the tree and passes
        await expect(accessor).toMatch('written-tree');
        expect(existsSync(fixtureFile)).toBeTruthy();
    });
});

describe('response comparison — compareResponse', () => {
    test('matches status, header subset, and body with tokens', () => {
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

    test('reports status, header, and body mismatches distinctly', () => {
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
});

describe('the hint a missing golden gives names a run that does something', () => {
    beforeAll(async () => {
        await registerMatchers();
    });

    test('an ordinary missing golden sends the author to update mode', () => {
        // Given - a subject whose fixture was never written
        const testDir = mkdtempSync(join(tmpdir(), 'hint-'));
        const subject = new TextAccessor('out', 'stdout', testDir);

        // Then - update mode is where it comes from
        expect(() => {
            expect(subject).toMatch('nowhere.txt');
        }).toThrow('Run with TEST_UPDATE=1');
    });

    test('a FROZEN missing golden does not, because update mode skips it', () => {
        // Given - the same subject, asked for a frozen fixture that is absent
        const testDir = mkdtempSync(join(tmpdir(), 'hint-'));
        const subject = new TextAccessor('out', 'stdout', testDir);

        // Then - the hint names the two things that do work, and not the one
        // That silently writes nothing: `{ frozen }` IS the no-write switch
        expect(() => {
            expect(subject).toMatch('nowhere.txt', { frozen: true });
        }).toThrow('Write the file by hand');
    });
});

describe('toMatchRows states the shape it wants before it queries', () => {
    beforeAll(async () => {
        await registerMatchers();
    });

    test('a bare array of rows is refused by the matcher, not by the adapter', async () => {
        // Given - a real table subject and the instinctive argument: the rows,
        // Without the columns the adapter needs to build its SELECT
        const subject = new TableAccessor('MapPoi', {
            query: async () => await Promise.resolve([]),
            reset: async () => {
                await Promise.resolve();
            },
            seed: async () => {
                await Promise.resolve();
            },
        });
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the wrong shape IS the subject: the guard exists for the call the types already refuse
        const pending = expect(subject).toMatchRows([{ id: 1 }] as never);

        // Then - the refusal names the matcher and the shape, rather than
        // Surfacing as a TypeError from inside SQL generation
        await expect(pending).rejects.toThrow('toMatchRows takes { columns, rows }');
    });
});
