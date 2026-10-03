import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { directory, file } from '../../disk/spec-path.js';
import type { DatabasePort } from '../../services/database.port.js';
import { ContainerAccessor } from '../command/container.js';
import { DirectoryAccessor } from '../disk/directory.js';
import { FilesystemAccessor } from '../disk/filesystem.js';
import { ResponseAccessor } from '../http/response.js';
import { TableAccessor } from '../table/table.js';
import { JsonAccessor } from '../text/json.js';
import { TextAccessor } from '../text/text.js';
import { registerMatchers } from './matchers.js';

await registerMatchers();

describe('registerMatchers', () => {
    test('matchers — toMatch — native string behavior preserved (`golden-read-from-its-path`) — a plain string still matches a regexp', () => {
        // Given - a plain string subject (not an accessor)
        // Then - native regexp semantics survive the override
        expect('abc').toMatch(/b/u);
        expect('abc').not.toMatch(/z/u);
    });

    test('matchers — toMatch — native string behavior preserved (`golden-read-from-its-path`) — a plain string still matches a substring', () => {
        // Given - a plain string subject
        // Then - native substring semantics survive the override
        expect('hello world').toMatch('world');
        expect('hello world').not.toMatch('nope');
    });

    test("matchers — toMatch is vitest's for a value, and the golden for the disk (`one-verb-per-meaning`) — a stream is compared whole to a text in place: a RegExp is refused naming its .text", () => {
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
            subject: () =>
                new ContainerAccessor({
                    containerId: null,
                    inspectData: null,
                    resultOf: () => {
                        throw new Error('an absent container runs no command');
                    },
                    testDir: '/tmp',
                }),
        },
    ])(
        "matchers — toMatch is vitest's for a value, and the golden for the disk (`one-verb-per-meaning`) — $name takes no value: a value handed to it is refused, naming $golden",
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
        "matchers — toMatch is vitest's for a value, and the golden for the disk (`one-verb-per-meaning`) — $name is refused a value of the wrong shape, naming the one it takes",
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

    test("matchers — toMatch is vitest's for a value, and the golden for the disk (`one-verb-per-meaning`) — toContain on a stream is vitest's: its .text answers, and no override reads the accessor", () => {
        // Given - a stream subject, ANSI included
        const subject = new TextAccessor('\u001B[31mbuilt in 3s\u001B[0m', 'stdout', '/tmp');

        // Then - the comparable text holds the words; the accessor itself is no list vitest can search
        expect(subject.text).toContain('built in 3s');
        expect(() => {
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- past the compiler, which refuses a stream handed to toContain
            expect(subject as unknown as string[]).toContain('built in 3s');
        }).toThrow(/to include 'built in 3s'/u);
    });

    test("matchers — toMatch is vitest's for a value, and the golden for the disk (`one-verb-per-meaning`) — an empty stream is an empty text: toBeEmpty refuses a stream, naming the form to write", async () => {
        // Given - an empty stream, and a table's matcher handed to it past the compiler
        const stream = new TextAccessor('', 'stderr', '/tmp');
        // @ts-expect-error -- a table's matcher handed a stream, past the compiler
        const subject: TableAccessor = stream;

        // Then - refused with vitest's own form, which holds on the comparable text
        await expect(expect(subject).toBeEmpty()).rejects.toThrow(
            /fix: compare its text: expect\(<result>\.stderr\.text\)\.toBe\(''\)/u,
        );
        expect(stream.text).toBe('');
    });

    test("matchers — toMatch is vitest's for a value, and the golden for the disk (`one-verb-per-meaning`) — a file golden refuses a tree subject, naming directory()", () => {
        // Given - a directory subject handed a file golden, past the compiler
        // @ts-expect-error -- a directory handed where a text subject belongs, past the compiler
        const subject: TextAccessor = new DirectoryAccessor('/tmp', '/tmp');

        // Then - the refusal names the wrapper a tree takes
        expect(() => {
            // checker-disable-next-line named-path-exists -- the refusal under test fires before any disk is read
            expect(subject).toMatch(file('./_expected/tree.txt'), { frozen: true });
        }).toThrow(/a directory or the working directory is `await toMatch\(directory\(…\)\)`/u);
    });

    test("matchers — toMatch is vitest's for a value, and the golden for the disk (`one-verb-per-meaning`) — a file golden refuses a value subject", () => {
        // Given - a plain string, which has no golden, past the compiler
        // @ts-expect-error -- a bare string handed where a text subject belongs, past the compiler
        const subject: TextAccessor = 'abc';

        // Then - the file is refused, naming the subjects a file golden compares against
        expect(() => {
            // checker-disable-next-line named-path-exists -- the refusal under test fires before any disk is read
            expect(subject).toMatch(file('./_expected/abc.txt'));
        }).toThrow(/fix: compare a stream, a json or a response to its file/u);
    });

    test("matchers — toMatch is vitest's for a value, and the golden for the disk (`one-verb-per-meaning`) — a directory golden refuses a stream subject, as a rejection", async () => {
        // Given - a stream subject handed a directory golden, past the compiler
        // @ts-expect-error -- a text subject handed where a directory belongs, past the compiler
        const subject: DirectoryAccessor = new TextAccessor('out', 'stdout', '/tmp');

        // Then - the refusal is awaited like the golden it stands for
        await expect(
            // checker-disable-next-line named-path-exists -- the refusal under test fires before any disk is read
            expect(subject).toMatch(directory('./_expected/out/'), { frozen: true }),
        ).rejects.toThrow(/on a subject that is no tree/u);
    });

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
        'matchers — update mode records a golden whatever the file holds: nothing, or no file at all (`no-volatile-literal`) — %s: an empty golden is filled from what came back',
        async (_kind, name, subject, written) => {
            // Given - update mode, and a golden that exists and holds nothing — a file created to be recorded
            await registerMatchers();
            vi.stubEnv('TEST_UPDATE', '1');
            const scratch = mkdtempSync(join(tmpdir(), 'empty-golden-'));
            onTestFinished(() => {
                rmSync(scratch, { force: true, recursive: true });
            });
            mkdirSync(resolve(scratch, '_expected'));
            const fixturePath = resolve(scratch, '_expected', name);
            writeFileSync(fixturePath, '');

            // Then - update mode writes it as if it were missing, and passes
            // checker-disable-next-line named-path-exists -- the golden resolves against the hand-built accessor's scratch directory, not this file's
            expect(subject(scratch)).toMatch(file(`./_expected/${name}` as const));
            expect(readFileSync(fixturePath, 'utf8')).toContain(written);
        },
    );
});
