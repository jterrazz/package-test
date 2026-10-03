import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { directory, file } from '../../disk/spec-path.js';
import { DirectoryAccessor } from '../disk/directory.js';
import { FilesystemAccessor } from '../disk/filesystem.js';
import { ResponseAccessor } from '../http/response.js';
import { JsonAccessor } from '../text/json.js';
import { TextAccessor } from '../text/text.js';
import {
    absentContainer,
    emptiness,
    oneVerb,
    refusalOf,
    registered,
    tableOf,
} from './matchers.fixtures.js';
import { registerMatchers } from './matchers.js';
import { scratchTest } from './response-goldens.fixtures.js';
import { GOLDEN_MATCHER, WHOLE_MATCHER } from './text-assertions.js';

const refused = (subject: unknown, value: unknown): string =>
    refusalOf(() => {
        // @ts-expect-error -- these subjects take no such value
        expect(subject).toMatch(value);
    });

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
            // @ts-expect-error -- a RegExp on a stream is refused by the type before the run refuses it
            expect(subject).toMatch(/built in/u);
        }).toThrow(
            "fix: write the whole text in place, toMatch('…'), or match a part with vitest on its text: expect(<result>.stdout.text).toMatch(…)",
        );
        expect(subject.text).toMatch(/^built in \ds$/mu);
    });

    test("matchers — toMatch is vitest's for a value, and the golden for the disk (`one-verb-per-meaning`) — a subject handed a value it is not compared to is refused, naming the form it takes", () => {
        // Given - each subject that takes no value, or a value of another shape, past the compiler

        // Then - the found and fix lines of each refusal
        expect([
            refused(new DirectoryAccessor('/tmp', '/tmp'), '1'),
            refused(new FilesystemAccessor('/tmp', '/tmp'), /1/u),
            refused(absentContainer(), 1),
            refused(
                new ResponseAccessor({ body: { id: 1 }, headers: {}, status: 200 }, '/tmp'),
                /200/u,
            ),
            refused(new JsonAccessor('{ "id": 1 }', 'stdout', '/tmp'), /id/u),
            refused(tableOf([]), '1'),
            refused(tableOf([]), [1]),
        ]).toStrictEqual([
            oneVerb(
                'toMatch(a string) on a directory',
                'compare it to its golden tree: `await expect(…).toMatch(directory(…))`',
            ),
            oneVerb(
                'toMatch(a RegExp) on a directory',
                'compare it to its golden tree: `await expect(…).toMatch(directory(…))`',
            ),
            oneVerb(
                'toMatch(a number) on a container',
                'assert its state, `await expect(…).toBeRunning()`, or compare its logs, `result.container(…).stdout`, whole',
            ),
            oneVerb(
                'toMatch(a RegExp) on a response',
                'write the whole response in place, ``toMatch(`HTTP/1.1 200 OK …`)``, or compare it to toMatch(file(…))',
            ),
            oneVerb(
                'toMatch(a RegExp) on a json',
                'write the whole value in place, `toMatch({ … })`, or compare it to toMatch(file(…))',
            ),
            oneVerb(
                'toMatch(a string) on a table',
                "write its rows in place, one array of cells per row in the table's column order: `await expect(result.table('<name>')).toMatch([[…]])`",
            ),
            oneVerb(
                'toMatch(an array) on a table',
                "write its rows in place, one array of cells per row in the table's column order: `await expect(result.table('<name>')).toMatch([[…]])`",
            ),
        ]);
    });

    test("matchers — toMatch is vitest's for a value, and the golden for the disk (`one-verb-per-meaning`) — the matchers reached directly: a golden takes only a disk path, a value in place only a subject it compares", async () => {
        // Given - the registered matchers called by name, without the call a routed comparison carries
        const json = new JsonAccessor('{ "id": 1 }', 'stdout', '/tmp');

        // Then - a match passes, and each value with no comparison is refused
        expect([
            refusalOf(() => registered(json, GOLDEN_MATCHER)('./_expected/a.json')),
            refusalOf(() => registered(json, WHOLE_MATCHER)({ id: 1 })),
            refusalOf(() => registered(new DirectoryAccessor('/tmp', '/tmp'), WHOLE_MATCHER)('x')),
            refusalOf(() => registered(tableOf([]), WHOLE_MATCHER)(5)),
            refusalOf(() => registered(new TextAccessor('x', 'stdout', '/tmp'), WHOLE_MATCHER)(5)),
        ]).toStrictEqual([
            oneVerb(
                'toMatch(a string) routed to the golden comparison',
                'name the golden with file(…) or directory(…)',
            ),
            '',
            oneVerb(
                'toMatch(a string) on a subject that is not compared to a value written in place',
                'compare it to its golden, `toMatch(file(…))`, or assert a part of its text with vitest on `.text`',
            ),
            oneVerb(
                'toMatch(a number) on a subject that is not compared to a value written in place',
                'compare it to its golden, `toMatch(file(…))`, or assert a part of its text with vitest on `.text`',
            ),
            oneVerb(
                'toMatch(a number) on a subject that is not compared to a value written in place',
                'compare it to its golden, `toMatch(file(…))`, or assert a part of its text with vitest on `.text`',
            ),
        ]);
    });

    test('matchers — toBeEmpty — a table with no row is empty, one with rows is counted, and a stream or a subject that is no table is refused', async () => {
        // Given - tables of no row, one and two, and a json past the compiler
        const json = new JsonAccessor('1', 'stdout', '/tmp');
        const [none, one, two] = [tableOf([]), tableOf([[1]]), tableOf([[1], [2]])];

        // Then - each verdict
        expect([
            await emptiness(none),
            await emptiness(one, true),
            await emptiness(one),
            await emptiness(two),
            await emptiness(none, true),
            await emptiness(json),
            await emptiness(new TextAccessor('', 'stderr', '/tmp')),
        ]).toStrictEqual([
            'passed',
            'passed',
            'Expected table "orders" to be empty, but it has 1 row',
            'Expected table "orders" to be empty, but it has 2 rows',
            'expected table "orders" not to be empty',
            oneVerb(
                'toBeEmpty() on a subject that is no table',
                "assert a table empty, `await expect(result.table('<name>')).toBeEmpty()`; any other subject is compared whole with toMatch",
            ),
            oneVerb(
                'toBeEmpty() on the stream "stderr" — an empty stream is an empty text',
                "compare its text: expect(<result>.stderr.text).toBe('')",
            ),
        ]);
    });

    test("matchers — toMatch is vitest's for a value, and the golden for the disk (`one-verb-per-meaning`) — toContain on a stream is vitest's: its .text answers, and no override reads the accessor", () => {
        // Given - a stream subject, ANSI included
        const subject = new TextAccessor('\u001B[31mbuilt in 3s\u001B[0m', 'stdout', '/tmp');

        // Then - the comparable text holds the words; the accessor itself is no list vitest can search
        expect(subject.text).toContain('built in 3s');
        expect(() => {
            // @ts-expect-error -- a stream is no list: the type refuses toContain on it
            expect(subject).toContain('built in 3s');
        }).toThrow(/to include 'built in 3s'/u);
    });

    test("matchers — toMatch is vitest's for a value, and the golden for the disk (`one-verb-per-meaning`) — a file golden refuses a tree subject, naming directory()", () => {
        // Given - a directory subject handed a file golden, past the compiler
        // @ts-expect-error -- a directory handed where a text subject belongs, past the compiler
        const subject: TextAccessor = new DirectoryAccessor('/tmp', '/tmp');

        // Then - the refusal names the wrapper a tree takes
        expect(() => {
            // checker-disable-next-line named-path-exists -- the refusal under test fires before any disk is read
            expect(subject).toMatch(file('./_expected/tree.txt'), { frozen: true });
        }).toThrow(
            new TypeError(
                oneVerb(
                    'toMatch(file("./_expected/tree.txt")) on a subject that holds no file of its kind',
                    'compare a stream, a json or a response to its file; a directory or the working directory is `await toMatch(directory(…))`',
                ),
            ),
        );
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

    test('matchers — update mode never writes a frozen golden, nor a value a negation states', () => {
        // Given - update mode, a frozen golden never recorded, and a negated mismatch in place
        vi.stubEnv('TEST_UPDATE', '1');
        const scratch = mkdtempSync(join(tmpdir(), 'frozen-golden-'));
        const negated = scratchTest("expect(result.stdout).not.toMatch('other');");

        // When - each is compared
        expect(() => {
            // checker-disable-next-line named-path-exists -- the golden resolves against the hand-built accessor's scratch directory, not this file's
            expect(new TextAccessor('out', 'stdout', scratch)).toMatch(file('./_expected/f.txt'), {
                frozen: true,
            });
        }).toThrow('stdout fixture "./_expected/f.txt" does not exist');
        void registered(
            new TextAccessor('out\n', 'stdout', '/tmp'),
            WHOLE_MATCHER,
            true,
        )('other', { options: undefined, stack: negated.stack });

        // Then - the frozen golden missing and unwritten, the negation's test untouched
        expect([existsSync(resolve(scratch, '_expected/f.txt')), negated.read()]).toStrictEqual([
            false,
            "test('records', async () => {\n    expect(result.stdout).not.toMatch('other');\n});\n",
        ]);
    });
});
