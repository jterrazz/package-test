import { lessonParts } from '@jterrazz/typescript/rules';
import { describe, expect, test } from 'vitest';

import { invariant, refusal } from '../refusal.js';
import { REFUSAL_WHY } from '../rows.js';

describe('refusal', () => {
    test("refusal — a refusal — the lesson the runtime throws — states the case, the row's sentence and the row's heading, a part per line", () => {
        // Given - a refusal of the disk law, for one call
        const message = refusal('disk-named-by-relative-path-at-runtime', {
            fix: "start it with ./ or ../: file('./out.txt')",
            found: 'file("out.txt"), a path that is not relative to the spec file',
        });

        // Then - four lines, the row giving the why and the read
        expect(message).toBe(
            [
                'found: file("out.txt"), a path that is not relative to the spec file',
                `why: ${REFUSAL_WHY['disk-named-by-relative-path-at-runtime']}`,
                "fix: start it with ./ or ../: file('./out.txt')",
                'read: docs/reference/linting.md#disk-named-by-relative-path-at-runtime',
            ].join('\n'),
        );
        expect(lessonParts(message)?.read).toBe(
            'docs/reference/linting.md#disk-named-by-relative-path-at-runtime',
        );
    });

    test('refusal — a refusal read in its chapter — states its four parts in their order, the read the heading that explains it', () => {
        // Given - a refusal no catalogue row owns, read in the chapter of its verb
        const message = refusal({
            fix: "take one first: using _ = clock.at('2026-03-04T09:30:00Z')",
            found: 'clock.advance(), and no clock is pinned',
            read: 'docs/reference/time-and-doubles.md#the-clock',
            why: 'A clock moves only once it is pinned.',
        });

        // Then - four lines, found first and read last
        expect(message).toBe(
            [
                'found: clock.advance(), and no clock is pinned',
                'why: A clock moves only once it is pinned.',
                "fix: take one first: using _ = clock.at('2026-03-04T09:30:00Z')",
                'read: docs/reference/time-and-doubles.md#the-clock',
            ].join('\n'),
        );
    });

    test('refusal — a refusal of a row handed no case — throws rather than print an empty found and fix', () => {
        // Given - an untyped caller naming a row and nothing else
        const row = ['disk-named-by-relative-path-at-runtime'];

        // Then - a broken invariant of the framework, naming the row it was handed
        expect(() => {
            Reflect.apply(refusal, undefined, row);
        }).toThrow(
            new Error(
                "@jterrazz/test broke one of its own invariants — a bug of the framework, not of the test: refusal('disk-named-by-relative-path-at-runtime') was handed no found and no fix for its case",
            ),
        );
    });

    test("invariant — a broken invariant — is an error that says the bug is the framework's, then what broke", () => {
        // Given - an invariant the framework holds for itself
        const error = invariant('the run containers are served on no port');

        // Then - the message clears the test, and names the invariant
        expect(error.message).toBe(
            '@jterrazz/test broke one of its own invariants — a bug of the framework, not of the test: the run containers are served on no port',
        );
    });
});
