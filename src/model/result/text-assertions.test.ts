import { describe, expect, test } from 'vitest';

import { file } from '../chain/spec-path.js';
import {
    GOLDEN_MATCHER,
    matchThroughGolden,
    streamValueRoute,
    WHOLE_MATCHER,
} from './text-assertions.js';
import { TextAccessor } from './text.js';

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
            '"stderr" is a stream, compared whole to the text written in place — a RegExp matches a part of it, which is vitest\'s: expect(<stream>.text).toMatch(…)',
        );
        expect(streamValueRoute('built', 'built')).toBeUndefined();
    });
});
