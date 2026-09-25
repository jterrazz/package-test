import { describe, expect, test } from 'vitest';

import { file } from '../../kernel/files/spec-path.js';
import { TextAccessor } from '../text/text.js';
import {
    cutFramesUnder,
    GOLDEN_MATCHER,
    matchThroughGolden,
    streamValueRoute,
    WHOLE_MATCHER,
} from './text-assertions.js';

/**
 * The framework routes `toMatch`'s disk arguments to the golden and leaves every
 * value to vitest — identically on both sides of the browser seam, since both
 * builds call the same function.
 */

/** What `overwriteMethod` is handed: the original, and the method that replaces it. */
type Overwrite = (original: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown;

/** A chai whose `toMatch` records who answered, over `subject`. */
function chaiWith(
    answered: string[],
    subject?: unknown,
): {
    Assertion: { prototype: Record<string, unknown> };
    util: {
        flag: (assertion: object, key: 'object') => unknown;
        overwriteMethod: (target: object, name: string, method: Overwrite) => void;
    };
} {
    const prototype: Record<string, unknown> = {
        [GOLDEN_MATCHER]: () => answered.push('golden'),
        [WHOLE_MATCHER]: (_value: unknown, call: { stack?: unknown }) =>
            answered.push(
                typeof call.stack === 'string' && call.stack.includes('toMatch call site')
                    ? 'whole'
                    : 'no site',
            ),
        toMatch: () => answered.push('vitest'),
    };
    return {
        Assertion: { prototype },
        util: {
            flag: () => subject,
            overwriteMethod: (target, name, method) => {
                const record = target as Record<string, (...args: unknown[]) => unknown>;
                const original = record[name];
                if (original !== undefined) {
                    record[name] = method(original);
                }
            },
        },
    };
}

/** The `toMatch` a chai carries once the route is laid over it. */
function toMatchOf(chai: ReturnType<typeof chaiWith>): (this: unknown, value: unknown) => void {
    return chai.Assertion.prototype.toMatch as (this: unknown, value: unknown) => void;
}

describe('matchThroughGolden', () => {
    test('hands the disk to the golden and every value to vitest, untouched', () => {
        // Given - a chai whose two answers are recorded
        const answered: string[] = [];
        const chai = chaiWith(answered);
        matchThroughGolden(chai, streamValueRoute);
        const toMatch = toMatchOf(chai);

        // When - a file, a string and a RegExp reach toMatch
        // checker-disable-next-line c8 -- the routing under test hands the path to a recorder: nothing reads the disk
        toMatch.call(chai.Assertion.prototype, file('./expected/out.txt'));
        toMatch.call(chai.Assertion.prototype, 'out');
        toMatch.call(chai.Assertion.prototype, /out/u);

        // Then - one golden, and two answers that are vitest's own
        expect(answered).toStrictEqual(['golden', 'vitest', 'vitest']);
    });

    test('refuses a value on a subject the caller names, and still hands that subject the disk', () => {
        // Given - a chai whose subject the caller refuses any value on
        const answered: string[] = [];
        const chai = chaiWith(answered, 'valueless');
        matchThroughGolden(chai, (subject) =>
            subject === 'valueless' ? new TypeError('takes toMatch(file(…))') : undefined,
        );
        const toMatch = toMatchOf(chai);

        // When - a file reaches toMatch
        // checker-disable-next-line c8 -- the routing under test hands the path to a recorder: nothing reads the disk
        toMatch.call(chai.Assertion.prototype, file('./expected/out.txt'));

        // Then - the golden answered it, and a value is refused before vitest is asked
        expect(answered).toStrictEqual(['golden']);
        expect(() => {
            toMatch.call(chai.Assertion.prototype, 'out');
        }).toThrow('takes toMatch(file(…))');
    });

    test('hands a value the route reads whole to the whole-result comparison, with its call site', () => {
        // Given - the route laid with the stream route, over a stream subject
        const answered: string[] = [];
        const chai = chaiWith(answered, new TextAccessor('built\n', 'stderr', '/tmp'));
        matchThroughGolden(chai, streamValueRoute);
        const toMatch = toMatchOf(chai);

        // When - a text reaches toMatch
        toMatch.call(chai.Assertion.prototype, 'built\n');

        // Then - compared whole, handed the stack of the call; a RegExp is refused naming the text
        expect(answered).toStrictEqual(['whole']);
        expect(() => {
            toMatch.call(chai.Assertion.prototype, /built/u);
        }).toThrow(
            "fix: write the whole text in place, toMatch('…'), or match a part with vitest on its text: expect(<result>.stderr.text).toMatch(…)",
        );
        expect(streamValueRoute('built', 'built')).toBeUndefined();
    });
});

describe("cutFramesUnder — a failure raised in a browser page shows the test's own line first", () => {
    test("cuts every frame this router's own directory holds, wherever vitest interleaved its own around them", () => {
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

    test('leaves a multi-line message untouched — a diff is not mistaken for a frame', () => {
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

    test('a node frame with no parenthesised function name is read the same as one with one', () => {
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

    test('a stack with nothing under the given directory is returned as it stands', () => {
        // Given - a stack this router never routed
        const stack = ['Error: x', '    at /repo/specs/widget.spec.ts:9:3'].join('\n');

        // Then - unchanged
        expect(cutFramesUnder(stack, '/repo/dist')).toBe(stack);
    });
});
