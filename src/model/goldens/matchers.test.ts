import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    inject,
    onTestFinished,
    test,
    vi,
} from 'vitest';

import { ContainerAccessor } from '../../results/container.js';
import { DirectoryAccessor } from '../../results/directory.js';
import { FilesystemAccessor } from '../../results/filesystem.js';
import { JsonAccessor } from '../../results/json.js';
import { ResponseAccessor } from '../../results/response.js';
import { TableAccessor } from '../../results/table.js';
import { TextAccessor } from '../../results/text.js';
import { directory, file } from '../chain/spec-path.js';
import { parseResponseFile, serializeResponseFile } from '../http-files/http-file.js';
import { CaptureScope } from '../matching/match.js';
import type { DatabasePort } from '../ports/database.port.js';
import { deferRewritesTo } from './in-place.js';
import { buildUpdatedResponse, compareResponse, registerMatchers } from './matchers.js';
import { WHOLE_MATCHER } from './text-assertions.js';

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

describe("toMatch is vitest's for a value, and the golden for the disk (D14)", () => {
    beforeAll(async () => {
        await registerMatchers();
    });

    // C13 — the 16 ground names are gone: no bridge reads them.
    test('a golden named in expected/ is not read from the 16 _expected/ beside it', () => {
        // Given - a spec directory holding only the 16 folder, and a golden it would match
        const specDir = mkdtempSync(join(tmpdir(), 'bridge-'));
        try {
            mkdirSync(join(specDir, '_expected'));
            writeFileSync(join(specDir, '_expected/out.txt'), 'built\n');
            const subject = new TextAccessor('built\n', 'stdout', specDir);

            // Then - the path is read where it says, and the refusal names it
            expect(() => {
                // checker-disable-next-line c8 -- negative spec: the golden missing from expected/ IS the behaviour under test
                expect(subject).toMatch(file('./expected/out.txt'), { frozen: true });
            }).toThrow(`does not exist at ${join(specDir, 'expected/out.txt')}`);
        } finally {
            rmSync(specDir, { force: true, recursive: true });
        }
    });

    // RUNTIME D14 — `toMatch` routes the disk to the golden, a value handed to a
    // Result subject to the whole-result comparison, and a value it cannot be
    // Compared to is refused naming what the subject takes.
    test('a stream is compared whole to a text in place: a RegExp is refused naming its .text', () => {
        // Given - a stream subject, ANSI included
        const subject = new TextAccessor('\u001B[31mbuilt in 3s\u001B[0m\n', 'stdout', '/tmp');

        // Then - a RegExp matches a part, which is vitest's on the comparable text
        expect(() => {
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- past the compiler, which refuses a RegExp on a stream
            expect(subject).toMatch(/built in/u as unknown as string);
        }).toThrow(
            "fix: write the whole text in place, toMatch('…'), or match a part with vitest on its text: expect(<result>.stdout.text).toMatch(…)",
        );
        expect(subject.text).toMatch(/^built in \ds$/mu);
    });

    test.each([
        {
            golden: 'toMatch(directory(…))',
            name: 'a directory',
            subject: () => new DirectoryAccessor('/tmp', '/tmp'),
        },
        {
            golden: 'toMatch(directory(…))',
            name: 'the working directory',
            subject: () => new FilesystemAccessor('/tmp', '/tmp'),
        },
        {
            golden: 'toBeRunning()',
            name: 'a container',
            subject: () => new ContainerAccessor(null, null, '/tmp'),
        },
    ])(
        '$name takes no value: a value handed to it is refused, naming $golden',
        ({ golden, subject }) => {
            // Given - a result accessor handed a string and a RegExp, past the compiler
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- past the compiler, which refuses a value on these subjects
            const accessor = subject() as unknown as string;

            // Then - the refusal names what the subject takes, never vitest's "expects to receive a string"
            expect(() => {
                expect(accessor).toMatch('1');
            }).toThrow(golden);
            expect(() => {
                expect(accessor).not.toMatch(/1/u);
            }).toThrow(golden);
        },
    );

    test.each([
        {
            name: 'a response',
            refusal: 'found: toMatch(a RegExp) on a response',
            subject: () =>
                new ResponseAccessor({ body: { id: 1 }, headers: {}, status: 200 }, '/tmp'),
            value: /200/u,
        },
        {
            name: 'a json',
            refusal: 'found: toMatch(a RegExp) on a json',
            subject: () => new JsonAccessor('{ "id": 1 }', 'stdout', '/tmp'),
            value: /id/u,
        },
        {
            name: 'a table',
            refusal:
                "fix: write its rows in place, one array of cells per row in the table's column order",
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the refusal fires before any query, so no database stands behind the table
            subject: () => new TableAccessor('orders', {} as DatabasePort),
            value: '1',
        },
    ])(
        '$name is refused a value of the wrong shape, naming the one it takes',
        ({ refusal, subject, value }) => {
            // Given - a result accessor handed a value it cannot be compared to, past the compiler
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- past the compiler, which refuses the shape
            const accessor = subject() as unknown as string;

            // Then - refused before anything is read, naming the form to write
            expect(() => {
                expect(accessor).toMatch(value);
            }).toThrow(refusal);
        },
    );

    test("toContain on a stream is vitest's: its .text answers, and no override reads the accessor", () => {
        // Given - a stream subject, ANSI included
        const subject = new TextAccessor('\u001B[31mbuilt in 3s\u001B[0m', 'stdout', '/tmp');

        // Then - the comparable text holds the words; the accessor itself is no list vitest can search
        expect(subject.text).toContain('built in 3s');
        expect(() => {
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- past the compiler, which refuses a stream handed to toContain
            expect(subject as unknown as string[]).toContain('built in 3s');
        }).toThrow(/to include 'built in 3s'/u);
    });

    test('an empty stream is an empty text: toBeEmpty refuses a stream, naming the form to write', async () => {
        // Given - an empty stream, and a table's matcher handed to it past the compiler
        const stream = new TextAccessor('', 'stderr', '/tmp');
        const subject = stream as unknown as TableAccessor;

        // Then - refused with vitest's own form, which holds on the comparable text
        await expect(expect(subject).toBeEmpty()).rejects.toThrow(
            /fix: compare its text: expect\(<result>\.stderr\.text\)\.toBe\(''\)/u,
        );
        expect(stream.text).toBe('');
    });

    test('a file golden refuses a tree subject, naming directory()', () => {
        // Given - a directory subject handed a file golden, past the compiler
        const subject = new DirectoryAccessor('/tmp', '/tmp') as unknown as TextAccessor;

        // Then - the refusal names the wrapper a tree takes
        expect(() => {
            // checker-disable-next-line c8 -- the refusal under test fires before any disk is read
            expect(subject).toMatch(file('./expected/tree.txt'), { frozen: true });
        }).toThrow(/a directory or the working directory is `await toMatch\(directory\(…\)\)`/u);
    });

    test('a file golden refuses a value subject', () => {
        // Given - a plain string, which has no golden, past the compiler
        const subject = 'abc' as unknown as TextAccessor;

        // Then - the file is refused, naming the subjects a file golden compares against
        expect(() => {
            // checker-disable-next-line c8 -- the refusal under test fires before any disk is read
            expect(subject).toMatch(file('./expected/abc.txt'));
        }).toThrow(/fix: compare a stream, a json or a response to its file/u);
    });

    test('a directory golden refuses a stream subject, as a rejection', async () => {
        // Given - a stream subject handed a directory golden, past the compiler
        const subject = new TextAccessor('out', 'stdout', '/tmp') as unknown as DirectoryAccessor;

        // Then - the refusal is awaited like the golden it stands for
        await expect(
            // checker-disable-next-line c8 -- the refusal under test fires before any disk is read
            expect(subject).toMatch(directory('./expected/out/'), { frozen: true }),
        ).rejects.toThrow(/on a subject that is no tree/u);
    });
});

describe('frozen fixtures are never rewritten under TEST_UPDATE (per-subject write gate, D13)', () => {
    // The stream subject is covered end-to-end by the cli assertions specs; these
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
        const accessor = new JsonAccessor('{ "id": 1 }', 'stdout', scratch);
        const fixturePath = resolve(scratch, 'expected', 'frozen.json');

        // Then - update mode is bypassed: it throws the does-not-exist error, no write
        expect(() => {
            // checker-disable-next-line c8 -- the golden resolves against the hand-built accessor's scratch directory, not this file's
            expect(accessor).toMatch(file('./expected/frozen.json'), { frozen: true });
        }).toThrow(/does not exist[\s\S]*TEST_UPDATE=1/u);
        expect(existsSync(fixturePath)).toBeFalsy();
    });

    test('json: a frozen wrong fixture keeps its content and throws its diff', () => {
        // Given - a deliberately-wrong committed json fixture
        const fixturePath = resolve(scratch, 'expected', 'wrong.json');
        mkdirSync(resolve(scratch, 'expected'), { recursive: true });
        writeFileSync(fixturePath, '{\n    "id": 999\n}\n');
        const accessor = new JsonAccessor('{ "id": 1 }', 'stdout', scratch);

        // Then - frozen mismatch still throws and never overwrites
        expect(() => {
            // checker-disable-next-line c8 -- the golden resolves against the hand-built accessor's scratch directory, not this file's
            expect(accessor).toMatch(file('./expected/wrong.json'), { frozen: true });
        }).toThrow();
        expect(readFileSync(fixturePath, 'utf8')).toBe('{\n    "id": 999\n}\n');
    });

    test('json: without frozen, update mode writes the fixture (control)', () => {
        // Given - the same missing fixture, but NOT frozen
        const accessor = new JsonAccessor('{ "id": 1 }', 'stdout', scratch);
        const fixturePath = resolve(scratch, 'expected', 'written.json');

        // Then - update mode writes it and passes
        // checker-disable-next-line c8 -- the golden resolves against the hand-built accessor's scratch directory, not this file's
        expect(accessor).toMatch(file('./expected/written.json'));
        expect(existsSync(fixturePath)).toBeTruthy();
    });

    test('response: a frozen missing fixture throws instead of being written', () => {
        // Given - a response subject and a missing fixture
        const accessor = new ResponseAccessor(
            { body: { ok: true }, headers: { 'content-type': 'application/json' }, status: 200 },
            scratch,
        );
        const fixturePath = resolve(scratch, 'expected', 'frozen.http');

        // Then - frozen bypasses the write, throwing the does-not-exist error
        expect(() => {
            // checker-disable-next-line c8 -- the golden resolves against the hand-built accessor's scratch directory, not this file's
            expect(accessor).toMatch(file('./expected/frozen.http'), { frozen: true });
        }).toThrow(/does not exist[\s\S]*TEST_UPDATE=1/u);
        expect(existsSync(fixturePath)).toBeFalsy();
    });

    test('response: without frozen, update mode writes the fixture (control)', () => {
        // Given - the same missing fixture, not frozen
        const accessor = new ResponseAccessor(
            { body: { ok: true }, headers: { 'content-type': 'application/json' }, status: 200 },
            scratch,
        );
        const fixturePath = resolve(scratch, 'expected', 'written.http');

        // Then - update mode writes and passes
        // checker-disable-next-line c8 -- the golden resolves against the hand-built accessor's scratch directory, not this file's
        expect(accessor).toMatch(file('./expected/written.http'));
        expect(existsSync(fixturePath)).toBeTruthy();
    });

    test('tree: a frozen missing fixture throws instead of being written', async () => {
        // Given - an actual output tree and a directory fixture that does not exist
        const actualRoot = resolve(scratch, 'actual');
        mkdirSync(actualRoot, { recursive: true });
        writeFileSync(resolve(actualRoot, 'file.txt'), 'hello\n');
        const accessor = new DirectoryAccessor(actualRoot, scratch);
        const fixtureDir = resolve(scratch, 'expected', 'frozen-tree');

        // Then - frozen bypasses the write (async matcher rejects), nothing created
        await expect(
            // checker-disable-next-line c8 -- the golden resolves against the hand-built accessor's scratch directory, not this file's
            expect(accessor).toMatch(directory('./expected/frozen-tree/'), { frozen: true }),
        ).rejects.toThrow(/does not exist[\s\S]*TEST_UPDATE=1/u);
        expect(existsSync(fixtureDir)).toBeFalsy();
    });

    test('tree: without frozen, update mode writes the fixture tree (control)', async () => {
        // Given - the same actual tree and a missing fixture, not frozen
        const actualRoot = resolve(scratch, 'actual');
        mkdirSync(actualRoot, { recursive: true });
        writeFileSync(resolve(actualRoot, 'file.txt'), 'hello\n');
        const accessor = new DirectoryAccessor(actualRoot, scratch);
        const fixtureFile = resolve(scratch, 'expected', 'written-tree', 'file.txt');

        // Then - update mode copies the tree and passes
        // checker-disable-next-line c8 -- the golden resolves against the hand-built accessor's scratch directory, not this file's
        await expect(accessor).toMatch(directory('./expected/written-tree/'));
        expect(existsSync(fixtureFile)).toBeTruthy();
    });
});

describe('update mode records a golden whatever the file holds: nothing, or no file at all (D5)', () => {
    test.each([
        [
            'stream',
            'empty.txt',
            (dir: string) => new TextAccessor('built\n', 'stdout', dir),
            'built\n',
        ],
        [
            'json',
            'empty.json',
            (dir: string) => new JsonAccessor('{ "id": 1 }', 'stdout', dir),
            '"id": 1',
        ],
        [
            'response',
            'empty.http',
            (dir: string) =>
                new ResponseAccessor(
                    {
                        body: { ok: true },
                        headers: { 'content-type': 'application/json' },
                        status: 200,
                    },
                    dir,
                ),
            'HTTP/1.1 200',
        ],
    ])(
        '%s: an empty golden is filled from what came back',
        async (_kind, name, subject, written) => {
            // Given - update mode, and a golden that exists and holds nothing — a file created to be recorded
            await registerMatchers();
            vi.stubEnv('TEST_UPDATE', '1');
            const scratch = mkdtempSync(join(tmpdir(), 'empty-golden-'));
            onTestFinished(() => {
                rmSync(scratch, { force: true, recursive: true });
            });
            mkdirSync(resolve(scratch, 'expected'));
            const fixturePath = resolve(scratch, 'expected', name);
            writeFileSync(fixturePath, '');

            // Then - update mode writes it as if it were missing, and passes
            // checker-disable-next-line c8 -- the golden resolves against the hand-built accessor's scratch directory, not this file's
            expect(subject(scratch)).toMatch(file(`./expected/${name}` as const));
            expect(readFileSync(fixturePath, 'utf8')).toContain(written);
        },
    );
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

describe("a golden that states no content-type reads its body by the actual response's", () => {
    test('in place and by file, a bare 42 is the text of a text/plain reply', async () => {
        await registerMatchers();
        // Given - a text/plain "42", and a golden with no content-type on disk
        const golden = goldenDir('HTTP/1.1 200 OK\n\n42\n');

        // Then - both read the golden's 42 as text, and match
        expect(plainCount('/tmp')).toMatch('HTTP/1.1 200 OK\n\n42');
        // checker-disable-next-line c8 -- the golden resolves against the hand-built accessor's scratch directory, not this file's
        expect(plainCount(golden.dir)).toMatch(file('./expected/count.http'), { frozen: true });
    });

    test('update mode writes a text/plain reply back as its bare text, by file and in place', async () => {
        await registerMatchers();
        // Given - update mode, a stale golden with no content-type on disk, and the same in place
        vi.stubEnv('TEST_UPDATE', '1');
        const golden = goldenDir('HTTP/1.1 200 OK\n\n41\n');
        const scratch = scratchTest(
            String.raw`expect(result.response).toMatch('HTTP/1.1 200 OK\n\n41');`,
        );

        // When - the reply is compared to each
        // checker-disable-next-line c8 -- the golden resolves against the hand-built accessor's scratch directory, not this file's
        expect(plainCount(golden.dir)).toMatch(file('./expected/count.http'));
        void wholeOf(plainCount('/tmp'))('HTTP/1.1 200 OK\n\n41', undefined, scratch.stack);

        // Then - both hold the text 42, never the JSON string "42"
        expect(golden.read()).toBe('HTTP/1.1 200 OK\n\n42\n');
        expect(scratch.read()).toContain(
            'toMatch(`\n        HTTP/1.1 200 OK\n\n        42\n    `);',
        );
    });

    test('update mode reads the golden it rewrites as text too: a token in a text/plain body is kept', async () => {
        await registerMatchers();
        // Given - update mode, a text/plain reply that looks like JSON, and a golden with no content-type holding a token
        vi.stubEnv('TEST_UPDATE', '1');
        const golden = goldenDir('HTTP/1.1 200 OK\n\n["{{int}}"]\n');
        const reply = new ResponseAccessor(
            { body: '["7"]', headers: { 'content-type': 'text/plain' }, status: 200 },
            golden.dir,
        );

        // When - the golden is re-recorded
        // checker-disable-next-line c8 -- the golden resolves against the hand-built accessor's scratch directory, not this file's
        expect(reply).toMatch(file('./expected/count.http'));

        // Then - the text still matched its token, so the token stays
        expect(golden.read()).toBe('HTTP/1.1 200 OK\n\n["{{int}}"]\n');
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
            // checker-disable-next-line c8 -- the golden resolves against the hand-built accessor's scratch directory, not this file's
            expect(subject).toMatch(file('./expected/nowhere.txt'));
        }).toThrow('Run with TEST_UPDATE=1');
    });

    test('a FROZEN missing golden does not, because update mode skips it', () => {
        // Given - the same subject, asked for a frozen fixture that is absent
        const testDir = mkdtempSync(join(tmpdir(), 'hint-'));
        const subject = new TextAccessor('out', 'stdout', testDir);

        // Then - the hint names the two things that do work, and not the one that silently writes nothing: `{ frozen }` IS the no-write switch
        expect(() => {
            // checker-disable-next-line c8 -- the golden resolves against the hand-built accessor's scratch directory, not this file's
            expect(subject).toMatch(file('./expected/nowhere.txt'), { frozen: true });
        }).toThrow('Write the file by hand');
    });
});

/** A text/plain reply whose text would parse as JSON. */
function plainCount(dir: string): ResponseAccessor {
    return new ResponseAccessor(
        { body: '42', headers: { 'content-type': 'text/plain' }, status: 200 },
        dir,
    );
}

/** A scratch directory holding `expected/count.http` with `content`, removed afterwards. */
function goldenDir(content: string): { dir: string; read: () => string } {
    const dir = mkdtempSync(join(tmpdir(), 'untyped-golden-'));
    onTestFinished(() => {
        rmSync(dir, { force: true, recursive: true });
    });
    mkdirSync(join(dir, 'expected'));
    const path = join(dir, 'expected', 'count.http');
    writeFileSync(path, content);
    return { dir, read: () => readFileSync(path, 'utf8') };
}

/** The whole-result comparison as a test calls it: a value, its options, and a stack of the test's making. */
type Whole = (expected: unknown, options: unknown, stack: string) => unknown;

/** The comparison as it is registered: a value, and the call the router hands it. */
type Registered = (expected: unknown, call: { options: unknown; stack: string }) => unknown;

/** The registered whole-result comparison on `subject`, negated or not. */
function wholeOf(subject: unknown, negated = false): Whole {
    // oxlint-disable-next-line vitest/valid-expect -- the assertion's matcher is the registered comparison, called below by the name no member access spells
    const assertion = expect(subject);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the matcher is registered under a name no member access spells; reaching it by that name is how a test hands it a stack of its own
    const target = (negated ? assertion.not : assertion) as unknown as Record<string, Registered>;
    return (expected, options, stack) => target[WHOLE_MATCHER]?.(expected, { options, stack });
}

/**
 * A scratch test holding `call` on its second line, and the stack a
 * `toMatch` standing there would hand the comparison. Removed afterwards.
 */
function scratchTest(call: string): { file: string; read: () => string; stack: string } {
    const scratch = mkdtempSync(join(tmpdir(), 'whole-in-place-'));
    const testFile = join(scratch, 'scratch.test.ts');
    writeFileSync(testFile, `test('records', async () => {\n    ${call}\n});\n`);
    // A scratch test is read back by the test that wrote it: written at once, never left for the run's end.
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

/**
 * Uuids in an order no test can predict from their names, drawn from a fixed
 * sequence so every run draws the same ones: what a table keyed by random
 * ids hands back, without sampling randomness.
 */
function uuidDraw(): () => string {
    let state = 7;
    return () => {
        state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
        return `${state.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;
    };
}

/** A database double holding one table, `users`, with the rows given. */
function usersTable(rows: unknown[][]): DatabasePort {
    return {
        columns: async () => await Promise.resolve(['id', 'name', 'created_at']),
        query: async () => await Promise.resolve(rows),
        reset: async () => {
            await Promise.resolve();
        },
        seed: async () => {
            await Promise.resolve();
        },
    };
}

describe('toMatch compares the whole result to the value written in place, and update mode writes it there (D5)', () => {
    beforeAll(async () => {
        await registerMatchers();
    });

    test('a stream against its text: indentation of the test dropped, tokens read, the golden diff on a mismatch', () => {
        // Given - a stream, and its text written in place, indented with the test
        const subject = new TextAccessor('built 3 files in 12ms\ndone\n', 'stdout', '/tmp');

        // Then - the whole text matches with a token, and a missing line is the golden's diff
        expect(subject).toMatch(`
            built 3 files in {{duration}}
            done
        `);
        expect(() => {
            expect(subject).toMatch(`
                built 3 files in {{duration}}
            `);
        }).toThrow(/Output mismatch \(the value in place\)[\s\S]*\+ done/u);
    });

    test('a response against its .http text: status, the headers it lists, the whole body', () => {
        // Given - a response
        const subject = new ResponseAccessor(
            {
                body: { id: UUID, name: 'Alice' },
                headers: { 'content-type': 'application/json', date: 'now' },
                status: 201,
            },
            '/tmp',
        );

        // Then - the text in place matches; a body field off is the golden's body diff
        expect(subject).toMatch(`
            HTTP/1.1 201 Created
            content-type: application/json

            {"id": "{{uuid}}", "name": "Alice"}
        `);
        expect(() => {
            expect(subject).toMatch(`
                HTTP/1.1 201 Created

                {"id": "{{uuid}}", "name": "Bob"}
            `);
        }).toThrow(/Response mismatch \(the value in place\)[\s\S]*"name": "Bob"/u);
        expect(() => {
            expect(subject).toMatch('HTTP/1.1 200 OK');
        }).toThrow('Response status mismatch (the value in place)');
    });

    test('a json against its value: tokens in its strings, every key compared', () => {
        // Given - a json
        const subject = new JsonAccessor(`{ "id": "${UUID}", "tags": ["a"] }`, 'stdout', '/tmp');

        // Then - the value matches whole; a missing key fails
        expect(subject).toMatch({ id: '{{uuid}}', tags: ['a'] });
        expect(() => {
            expect(subject).toMatch({ id: '{{uuid}}' });
        }).toThrow(/Response mismatch \(the value in place\)[\s\S]*\+ {3}"tags"/u);
    });

    test('a table against its rows: every column, an instant read as its ISO text', async () => {
        // Given - a table holding one row, its instant a Date as a driver hands it
        const subject = new TableAccessor(
            'users',
            usersTable([[7, 'Ada', new Date('2026-01-02T03:04:05.000Z')]]),
        );

        // Then - the rows match whole; a row too many is the table diff
        await expect(subject).toMatch([['{{int}}', 'Ada', '2026-01-02T03:04:05.000Z']]);
        await expect(expect(subject).toMatch([])).rejects.toThrow(
            /Table "users" mismatch[\s\S]*query: id, name, created_at[\s\S]*\+ 7 {2}\| {2}Ada/u,
        );
    });

    test('a table of rows keyed by random ids matches whatever order they come back in, run after run', async () => {
        // Given - fifty tables of three rows keyed by uuids drawn anew for each, each handed back in its first column's order
        const draw = uuidDraw();
        const runs = Array.from({ length: 50 }, () => {
            const rows = ['Ada', 'Bob', 'Cy'].map((name) => [draw(), name, '2026-01-02']);
            const sorted = rows.toSorted((a, b) => String(a[0]).localeCompare(String(b[0])));
            return { bob: rows[1]?.[0], subject: new TableAccessor('users', usersTable(sorted)) };
        });

        // Then - each matches the rows as the test states them, each id captured on its own row
        await Promise.all(
            runs.map(async ({ subject }) => {
                await expect(subject).toMatch([
                    ['{{uuid#ada}}', 'Ada', '2026-01-02'],
                    ['{{uuid#bob}}', 'Bob', '2026-01-02'],
                    ['{{uuid#cy}}', 'Cy', '2026-01-02'],
                ]);
            }),
        );
        expect(runs.map(({ subject }) => subject.captures.get('bob'))).toStrictEqual(
            runs.map(({ bob }) => bob),
        );
    });

    test("a table compared { ordered: true } holds its first column's order as part of the claim", async () => {
        // Given - two rows, handed back as the table orders them
        const subject = new TableAccessor(
            'users',
            usersTable([
                [1, 'Ada', '2026-01-02'],
                [2, 'Bob', '2026-01-02'],
            ]),
        );

        // Then - the rows in another order match as a multiset, and fail as an order
        await expect(subject).toMatch([
            [2, 'Bob', '2026-01-02'],
            [1, 'Ada', '2026-01-02'],
        ]);
        await expect(
            expect(subject).toMatch(
                [
                    [2, 'Bob', '2026-01-02'],
                    [1, 'Ada', '2026-01-02'],
                ],
                { frozen: true, ordered: true },
            ),
        ).rejects.toThrow(/- 2 {2}\| {2}Bob[\s\S]*\+ 1 {2}\| {2}Ada/u);
    });

    test('a table diff pairs each stated row with the row it resembles most, and shows the rows that match as matching', async () => {
        // Given - two rows, one stated with a wrong name, stated in the other order
        const subject = new TableAccessor(
            'users',
            usersTable([
                [1, 'Ada', '2026-01-02'],
                [2, 'Bob', '2026-01-02'],
            ]),
        );

        // Then - Bob's row matches, and Ada's is shown against the row it was meant to be
        await expect(
            expect(subject).toMatch(
                [
                    [2, 'Bob', '2026-01-02'],
                    [1, 'Eve', '2026-01-02'],
                ],
                { frozen: true },
            ),
        ).rejects.toThrow(
            /\n {2}2 {2}\| {2}Bob {2}\| {2}2026-01-02\n\S*- 1 {2}\| {2}Eve {2}\| {2}2026-01-02\S*\n\S*\+ 1 {2}\| {2}Ada/u,
        );
    });

    test('a table the database does not hold is refused naming it', async () => {
        // Given - a table with no columns
        const subject = new TableAccessor('ghost', {
            ...usersTable([]),
            columns: async () => await Promise.resolve([]),
        });

        // Then - refused, before a SELECT with no columns reaches the driver
        await expect(expect(subject).toMatch([])).rejects.toThrow(
            'table "ghost" has no columns: the database holds no such table.',
        );
    });

    test('an empty text is filled with the stream, as a block indented with the call', () => {
        // Given - a scratch test holding an empty value, under update mode
        vi.stubEnv('TEST_UPDATE', '1');
        const scratch = scratchTest('expect(result.stdout).toMatch(``);');

        // When - the stream is compared to it
        void wholeOf(new TextAccessor('built\ndone\n', 'stdout', '/tmp'))(
            '',
            undefined,
            scratch.stack,
        );

        // Then - the stream, written where the empty value stood
        expect(scratch.read()).toBe(
            "test('records', async () => {\n    expect(result.stdout).toMatch(`\n        built\n        done\n    `);\n});\n",
        );
    });

    test('a line whose token still matches keeps it; the lines that moved are rewritten', () => {
        // Given - a value in place with a token line and a stale line, under update mode
        vi.stubEnv('TEST_UPDATE', '1');
        const scratch = scratchTest(
            String.raw`expect(result.stdout).toMatch('built in {{duration}}\nold\n');`,
        );

        // When - the stream differs on the second line only
        void wholeOf(new TextAccessor('built in 5ms\nnew\n', 'stdout', '/tmp'))(
            'built in {{duration}}\nold\n',
            undefined,
            scratch.stack,
        );

        // Then - the token kept, the stale line replaced
        expect(scratch.read()).toContain('        built in {{duration}}\n        new\n    `');
    });

    test('a response not yet recorded fails naming update mode, and update mode writes its .http text', () => {
        // Given - a response, and an empty value in place
        const subject = new ResponseAccessor(
            { body: { id: UUID }, headers: { 'content-type': 'application/json' }, status: 201 },
            '/tmp',
        );
        const scratch = scratchTest('expect(result.response).toMatch(``);');

        // Then - refused outside update mode, written inside it with the uuid tokenised only where a token stood before
        expect(() => {
            void wholeOf(subject)('', undefined, scratch.stack);
        }).toThrow('nothing is written in place yet — run with TEST_UPDATE=1');
        vi.stubEnv('TEST_UPDATE', '1');
        void wholeOf(subject)('', undefined, scratch.stack);
        expect(scratch.read()).toContain(
            `toMatch(\`\n        HTTP/1.1 201 Created\n        content-type: application/json\n\n        {\n            "id": "${UUID}"\n        }\n    \`);`,
        );
    });

    test('a json keeps the tokens that still match and takes every other value', () => {
        // Given - a json whose id matches its token and whose name moved, under update mode
        vi.stubEnv('TEST_UPDATE', '1');
        const scratch = scratchTest(
            "expect(result.json).toMatch({ id: '{{uuid}}', name: 'Ada' });",
        );

        // When - compared
        void wholeOf(new JsonAccessor(`{"id":"${UUID}","name":"Grace"}`, 'stdout', '/tmp'))(
            { id: '{{uuid}}', name: 'Ada' },
            undefined,
            scratch.stack,
        );

        // Then - the token kept, the name rewritten, written as code
        expect(scratch.read()).toContain(
            'toMatch({\n        "id": "{{uuid}}",\n        "name": "Grace"\n    });',
        );
    });

    test('a table not yet recorded is written row by row, a cell keeping the token that still matches', async () => {
        // Given - a table, an empty value, then rows whose instant was a token
        vi.stubEnv('TEST_UPDATE', '1');
        const table = new TableAccessor(
            'users',
            usersTable([[1, 'Ada', new Date('2026-01-02T03:04:05.000Z')]]),
        );
        const empty = scratchTest("await expect(result.table('users')).toMatch('');");
        const tokened = scratchTest(
            "await expect(result.table('users')).toMatch([[1, 'Bob', '{{iso8601}}']]);",
        );

        // When - both are compared
        await wholeOf(table)('', undefined, empty.stack);
        await wholeOf(table)([[1, 'Bob', '{{iso8601}}']], undefined, tokened.stack);

        // Then - the rows as code; the instant kept as its token where one stood
        expect(empty.read()).toContain(
            'toMatch([\n        [1, "Ada", "2026-01-02T03:04:05.000Z"],\n    ]);',
        );
        expect(tokened.read()).toContain('toMatch([\n        [1, "Ada", "{{iso8601}}"],\n    ]);');
    });

    test('a value that matches, a frozen one and a negation are never written', () => {
        // Given - three calls in place, under update mode
        vi.stubEnv('TEST_UPDATE', '1');
        const subject = new TextAccessor('built\n', 'stdout', '/tmp');
        const matching = scratchTest(String.raw`expect(result.stdout).toMatch('built\n');`);
        const frozen = scratchTest("expect(result.stdout).toMatch('other', { frozen: true });");
        const negated = scratchTest(String.raw`expect(result.stdout).not.toMatch('built\n');`);

        // Then - each file byte for byte, the frozen and the negated mismatches still thrown
        void wholeOf(subject)('built\n', undefined, matching.stack);
        expect(() => {
            void wholeOf(subject)('other', { frozen: true }, frozen.stack);
        }).toThrow('Output mismatch (the value in place)');
        expect(() => {
            void wholeOf(subject, true)('built\n', undefined, negated.stack);
        }).toThrow('expected stdout not to match the value in place');
        expect(matching.read()).toContain(String.raw`toMatch('built\n');`);
        expect(frozen.read()).toContain("toMatch('other', { frozen: true });");
        expect(negated.read()).toContain(String.raw`not.toMatch('built\n');`);
    });
});
