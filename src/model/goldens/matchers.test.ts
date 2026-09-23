import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    onTestFinished,
    test,
    vi,
} from 'vitest';

import { ContainerAccessor } from '../../seams/docker/container-accessor.js';
import { directory, file } from '../chain/spec-path.js';
import { parseResponseFile, serializeResponseFile } from '../http-files/http-file.js';
import { CaptureScope } from '../matching/match.js';
import type { DatabasePort } from '../ports/database.port.js';
import { DirectoryAccessor } from '../result/directory.js';
import { FilesystemAccessor } from '../result/filesystem.js';
import { JsonAccessor } from '../result/json.js';
import { ResponseAccessor } from '../result/response.js';
import { TableAccessor } from '../result/table.js';
import { TextAccessor } from '../result/text.js';
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

    // RUNTIME D14 — `toMatch` routes the disk to the golden and a value to
    // Vitest, and a golden handed a subject of the other kind is refused.
    test('a stream accessor is not a string: a value is refused naming .text, and its .text matches', () => {
        // Given - a stream subject, ANSI included
        const subject = new TextAccessor('\u001B[31mbuilt in 3s\u001B[0m', 'stdout', '/tmp');

        // Then - the framework's refusal naming the text, and vitest's own match on that comparable text
        expect(() => {
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- past the compiler, which refuses a value matcher on a stream
            expect(subject as unknown as string).toMatch(/built in/u);
        }).toThrow(
            '"stdout" is a stream, and a stream compared as a value is its text — write expect(<stream>.text).toMatch(…)',
        );
        expect(() => {
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- past the compiler, which refuses a value matcher on a stream
            expect(subject as unknown as string).not.toMatch('failed');
        }).toThrow('expect(<stream>.text).toMatch(…)');
        expect(subject.text).toMatch(/^built in \ds$/u);
        expect(subject.text).not.toMatch('failed');
    });

    test.each([
        {
            golden: 'toMatch(file(…))',
            name: 'a json',
            subject: () => new JsonAccessor('{ "id": 1 }', '/tmp'),
        },
        {
            golden: 'toMatch(file(…))',
            name: 'a response',
            subject: () =>
                new ResponseAccessor({ body: { id: 1 }, headers: {}, status: 200 }, '/tmp'),
        },
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
            golden: 'toMatchRows(…)',
            name: 'a table',
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the refusal fires before any query, so no database stands behind the table
            subject: () => new TableAccessor('orders', {} as DatabasePort),
        },
        {
            golden: 'toBeRunning()',
            name: 'a container',
            subject: () => new ContainerAccessor(null, null, '/tmp'),
        },
    ])(
        '$name is no string: a value handed to it is refused, naming $golden',
        ({ golden, subject }) => {
            // Given - a result accessor handed a string and a RegExp, past the compiler
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- past the compiler, which refuses a value matcher on every result accessor
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
            /"stderr" is a stream, and an empty stream is an empty text — write expect\(<stream>\.text\)\.toBe\(''\)/u,
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
        }).toThrow(/a directory or the working directory is toMatch\(directory\(…\)\)/u);
    });

    test('a file golden refuses a value subject', () => {
        // Given - a plain string, which has no golden, past the compiler
        const subject = 'abc' as unknown as TextAccessor;

        // Then - the file is refused, naming the subjects a file golden compares against
        expect(() => {
            // checker-disable-next-line c8 -- the refusal under test fires before any disk is read
            expect(subject).toMatch(file('./expected/abc.txt'));
        }).toThrow(/a file golden is compared against a stream, json or response accessor/u);
    });

    test('a directory golden refuses a stream subject, as a rejection', async () => {
        // Given - a stream subject handed a directory golden, past the compiler
        const subject = new TextAccessor('out', 'stdout', '/tmp') as unknown as DirectoryAccessor;

        // Then - the refusal is awaited like the golden it stands for
        await expect(
            // checker-disable-next-line c8 -- the refusal under test fires before any disk is read
            expect(subject).toMatch(directory('./expected/out/'), { frozen: true }),
        ).rejects.toThrow(/a directory golden is compared against/u);
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
        const accessor = new JsonAccessor('{ "id": 1 }', scratch);

        // Then - frozen mismatch still throws and never overwrites
        expect(() => {
            // checker-disable-next-line c8 -- the golden resolves against the hand-built accessor's scratch directory, not this file's
            expect(accessor).toMatch(file('./expected/wrong.json'), { frozen: true });
        }).toThrow();
        expect(readFileSync(fixturePath, 'utf8')).toBe('{\n    "id": 999\n}\n');
    });

    test('json: without frozen, update mode writes the fixture (control)', () => {
        // Given - the same missing fixture, but NOT frozen
        const accessor = new JsonAccessor('{ "id": 1 }', scratch);
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
        ['json', 'empty.json', (dir: string) => new JsonAccessor('{ "id": 1 }', dir), '"id": 1'],
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

describe('toMatchRows states the shape it wants before it queries', () => {
    beforeAll(async () => {
        await registerMatchers();
    });

    test('a bare array of rows is refused by the matcher, not by the adapter', async () => {
        // Given - a real table subject and the instinctive argument: the rows, without the columns the adapter needs to build its SELECT
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

        // Then - the refusal names the matcher and the shape, rather than surfacing as a TypeError from inside SQL generation
        await expect(pending).rejects.toThrow('toMatchRows takes { columns, rows }');
    });
});
