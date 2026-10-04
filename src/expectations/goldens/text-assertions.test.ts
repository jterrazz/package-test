import { stripVTControlCharacters } from 'node:util';
import { describe, expect, test } from 'vitest';

import { file } from '../../disk/spec-path.js';
import { TextAccessor } from '../text/text.js';
import {
    chaiWith,
    routerFailure,
    stacklessError,
    thrownThrough,
    toMatchOf,
} from './text-assertions.fixtures.js';
import {
    compareStreamText,
    cutFramesUnder,
    emptyStreamRefusal,
    GOLDEN_MATCHER,
    matchThroughGolden,
    requireExtension,
    streamValueRoute,
    WHOLE_MATCHER,
} from './text-assertions.js';

describe('text-assertions', () => {
    test('matchThroughGolden — hands the disk to the golden and every value to vitest, untouched', () => {
        // Given - a chai whose two answers are recorded
        const answered: string[] = [];
        const chai = chaiWith(answered);
        matchThroughGolden(chai, streamValueRoute);
        const toMatch = toMatchOf(chai);

        // When - a file, a string and a RegExp reach toMatch
        // checker-disable-next-line named-path-exists -- the routing under test hands the path to a recorder: nothing reads the disk
        toMatch(file('./_expected/out.txt'));
        toMatch('out');
        toMatch(/out/u);

        // Then - one golden, and two answers that are vitest's own
        expect(answered).toStrictEqual(['golden', 'vitest', 'vitest']);
    });

    test('matchThroughGolden — refuses a value on a subject the caller names, and still hands that subject the disk', () => {
        // Given - a chai whose subject the caller refuses any value on
        const answered: string[] = [];
        const chai = chaiWith(answered, 'valueless');
        matchThroughGolden(chai, (subject) =>
            subject === 'valueless' ? new TypeError('takes toMatch(file(…))') : undefined,
        );
        const toMatch = toMatchOf(chai);

        // When - a file reaches toMatch
        // checker-disable-next-line named-path-exists -- the routing under test hands the path to a recorder: nothing reads the disk
        toMatch(file('./_expected/out.txt'));

        // Then - the golden answered it, and a value is refused before vitest is asked
        expect(answered).toStrictEqual(['golden']);
        expect(() => {
            toMatch('out');
        }).toThrow('takes toMatch(file(…))');
    });

    test('matchThroughGolden — hands a value the route reads whole to the whole-result comparison, with its call site', () => {
        // Given - the route laid with the stream route, over a stream subject
        const answered: string[] = [];
        const chai = chaiWith(answered, new TextAccessor('built\n', 'stderr', '/tmp'));
        matchThroughGolden(chai, streamValueRoute);
        const toMatch = toMatchOf(chai);

        // When - a text reaches toMatch
        toMatch('built\n');

        // Then - compared whole, handed the stack of the call; a RegExp is refused naming the text
        expect(answered).toStrictEqual(['whole']);
        expect(() => {
            toMatch(/built/u);
        }).toThrow(
            "fix: write the whole text in place, toMatch('…'), or match a part with vitest on its text: expect(<result>.stderr.text).toMatch(…)",
        );
        expect(streamValueRoute('built', 'built')).toBeUndefined();
    });

    test("cutFramesUnder — a failure raised in a browser page shows the test's own line first — cuts every frame this router's own directory holds, wherever vitest interleaved its own around them", () => {
        // Given - a page's bundle, where vitest's own matcher plumbing sits ABOVE this router on the stack, between it and the throw
        const stack = [
            'Error: Output mismatch (the value in place)',
            '    at http://localhost:5173/deps/vitest.js?v=1:100:1',
            '    at http://localhost:5173/deps/index.js?v=1:200:2',
            '    at async http://localhost:5173/specs/widget.test.tsx?import:8:5',
            '    at async http://localhost:5173/deps/plugins.js?v=1:300:3',
        ].join('\n');

        // Then - only the frames of the router's own directory are cut; the test's line, and every frame outside it, stay
        expect(cutFramesUnder(stack, 'http://localhost:5173/deps')).toBe(
            [
                'Error: Output mismatch (the value in place)',
                '    at async http://localhost:5173/specs/widget.test.tsx?import:8:5',
            ].join('\n'),
        );
    });

    test("cutFramesUnder — a failure raised in a browser page shows the test's own line first — leaves a multi-line message untouched — a diff is not mistaken for a frame", () => {
        // Given - a message with blank and dash-led lines, before the frames
        const stack = [
            'Error: Output mismatch',
            '',
            '- Expected',
            '+ Received',
            '    at /repo/dist/index.js:1:1',
            '    at /repo/specs/widget.spec.ts:9:3',
        ].join('\n');

        // Then - the message survives whole, and only the router's own frame is cut
        expect(cutFramesUnder(stack, '/repo/dist')).toBe(
            [
                'Error: Output mismatch',
                '',
                '- Expected',
                '+ Received',
                '    at /repo/specs/widget.spec.ts:9:3',
            ].join('\n'),
        );
    });

    test("cutFramesUnder — a failure raised in a browser page shows the test's own line first — a node frame with no parenthesised function name is read the same as one with one", () => {
        // Given - the two shapes V8 prints: a named caller, and a bare frame
        const stack = [
            'Error: x',
            '    at Proxy.toMatch (/repo/dist/index.js:5:5)',
            '    at /repo/specs/widget.spec.ts:9:3',
        ].join('\n');

        // Then - the named frame is cut like the bare one would be
        expect(cutFramesUnder(stack, '/repo/dist')).toBe(
            ['Error: x', '    at /repo/specs/widget.spec.ts:9:3'].join('\n'),
        );
    });

    test("cutFramesUnder — a failure raised in a browser page shows the test's own line first — a stack with nothing under the given directory is returned as it stands", () => {
        // Given - a stack this router never routed
        const stack = ['Error: x', '    at /repo/specs/widget.spec.ts:9:3'].join('\n');

        // Then - unchanged
        expect(cutFramesUnder(stack, '/repo/dist')).toBe(stack);
    });

    test('requireExtension — a golden is named with its extension, and one with none is refused whole', () => {
        // Given - paths with an extension, with none, and with a dot only in a folder
        const refusals = ['./_expected/help.txt', './_expected/help', './_expected.d/help'].map(
            (name) => {
                try {
                    requireExtension(name, 'the stream "stdout"');
                    return 'named';
                } catch (error) {
                    return String(error);
                }
            },
        );

        // Then - the named one passes, the others are refused in four parts
        expect(refusals).toStrictEqual([
            'named',
            ...['./_expected/help', './_expected.d/help'].map(
                (name) =>
                    `Error: found: toMatch(file("${name}")) on the stream "stdout", a golden path with no extension\nwhy: The extension is part of a golden’s path.\nfix: name the file with its extension: file('./_expected/help.txt')\nread: docs/reference/assertions.md#one-verb-compares-a-whole-result-and-its-argument-says-where-the-expectation-lives`,
            ),
        ]);
    });

    test('compareStreamText — a stream matching its text passes, and one that does not is shown with its token lines equal', () => {
        // Given - a stream whose first line a token covers and whose second differs
        const accessor = new TextAccessor('id 7\nstatus degraded', 'stdout', '/tmp');

        // Then - each comparison and its message
        const passing = compareStreamText(accessor, 'out.txt', 'id {{int}}\nstatus degraded');
        const failing = compareStreamText(accessor, 'out.txt', 'id {{int}}\nstatus ready');
        expect([
            passing.pass,
            passing.message(),
            failing.pass,
            stripVTControlCharacters(failing.message()).split('\n').slice(5),
        ]).toStrictEqual([
            true,
            'expected stdout not to match out.txt',
            false,
            ['  id {{int}}', '- status ready', '+ status degraded'],
        ]);
    });

    test('emptyStreamRefusal and streamValueRoute — a stream is compared as a whole text, and a value of another kind is refused naming it', () => {
        // Given - a stream subject
        const accessor = new TextAccessor('', 'stderr', '/tmp');

        // Then - the empty-stream refusal, and the route of each value
        expect([
            emptyStreamRefusal(accessor).message,
            streamValueRoute(accessor, 'text'),
            String(streamValueRoute(accessor, 42)),
            String(streamValueRoute(accessor, /x/u)).split('\n')[0],
        ]).toStrictEqual([
            'found: toBeEmpty() on the stream "stderr" — an empty stream is an empty text\nwhy: `toMatch` on a result the framework produced compares the WHOLE result, to a value written in place or to a `file()`/`directory()` golden.\nfix: compare its text: expect(<result>.stderr.text).toBe(\'\')\nread: docs/reference/linting.md#one-verb-per-meaning',
            'whole',
            'TypeError: found: toMatch(a number) on the stream "stderr"\nwhy: `toMatch` on a result the framework produced compares the WHOLE result, to a value written in place or to a `file()`/`directory()` golden.\nfix: write the whole text in place, toMatch(\'…\'), or match a part with vitest on its text: expect(<result>.stderr.text).toMatch(…)\nread: docs/reference/linting.md#one-verb-per-meaning',
            'TypeError: found: toMatch(a RegExp) on the stream "stderr"',
        ]);
    });

    test('matchThroughGolden — answers what the golden and whole comparison answer, awaiting a promise, and hands a whole comparison its options', async () => {
        // Given - a golden answering a value, a whole comparison recording its options, over a stream subject
        const answered: string[] = [];
        const options: unknown[] = [];
        const chai = chaiWith(answered, new TextAccessor('built\n', 'stderr', '/tmp'), {
            [GOLDEN_MATCHER]: async () => await Promise.resolve('read'),
            [WHOLE_MATCHER]: (_value: unknown, call: { options?: unknown }) => {
                options.push(call.options);
                return 'compared';
            },
        });
        matchThroughGolden(chai, streamValueRoute);
        const toMatch = toMatchOf(chai);

        // When - a file and texts with options of every shape reach toMatch
        // checker-disable-next-line named-path-exists -- the routing under test hands the path to a recorder: nothing reads the disk
        const golden = toMatch(file('./_expected/out.txt'));
        const answers = [
            toMatch('built\n'),
            toMatch('built\n', { frozen: true, ordered: true }),
            toMatch('built\n', { frozen: 1 }),
            toMatch('built\n', null),
        ];

        // Then - the golden's answer awaited, each whole answer as it came, each options read
        expect([await golden, answers, options]).toStrictEqual([
            'read',
            ['compared', 'compared', 'compared', 'compared'],
            [
                undefined,
                { frozen: true, ordered: true },
                { frozen: false, ordered: false },
                undefined,
            ],
        ]);
    });

    test('matchThroughGolden — a subject with no golden or whole comparison is vitest’s', () => {
        // Given - a plain subject with no golden, and a stream subject with no whole comparison
        const answered: string[] = [];
        const plain = chaiWith(answered, undefined, { [GOLDEN_MATCHER]: undefined });
        const stream = chaiWith(answered, new TextAccessor('built\n', 'stderr', '/tmp'), {
            [WHOLE_MATCHER]: undefined,
        });
        matchThroughGolden(plain, streamValueRoute);
        matchThroughGolden(stream, streamValueRoute);

        // When - a file reaches the first, a text the second
        // checker-disable-next-line named-path-exists -- the routing under test hands the path to a recorder: nothing reads the disk
        toMatchOf(plain)(file('./_expected/out.txt'));
        toMatchOf(stream)('built\n');

        // Then - both answered by vitest
        expect(answered).toStrictEqual(['vitest', 'vitest']);
    });

    test('matchThroughGolden — a failure thrown or rejected through the router loses the router’s frames, and anything else thrown passes untouched', async () => {
        // Given - goldens failing every way, each with a frame under the router's own directory

        // Then - each failure as the test reads it
        expect([
            await thrownThrough(() => {
                throw routerFailure();
            }),
            await thrownThrough(async () => await Promise.reject(routerFailure())),
            await thrownThrough(() => {
                throw stacklessError();
            }),
            await thrownThrough(() => {
                // oxlint-disable-next-line typescript/only-throw-error -- what is thrown is no error, the case under test
                throw 'a string';
            }),
        ]).toStrictEqual([
            'Error: mismatch\n    at /repo/specs/a.spec.ts:2:2',
            'Error: mismatch\n    at /repo/specs/a.spec.ts:2:2',
            'bare',
            'a string',
        ]);
    });

    test("cutFramesUnder — a failure raised in a browser page shows the test's own line first — a frame naming no file is kept", () => {
        // Given - an anonymous frame beside a router frame
        const stack = ['Error: x', '    at <anonymous>', '    at /repo/dist/index.js:1:1'].join(
            '\n',
        );

        // Then - the anonymous frame stays
        expect(cutFramesUnder(stack, '/repo/dist')).toBe('Error: x\n    at <anonymous>');
    });
});
