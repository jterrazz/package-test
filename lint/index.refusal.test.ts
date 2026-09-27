import { describe, expect, test } from 'vitest';

import { lessonParts } from './engine/catalogue/lesson-parts.js';
import { refusal, REFUSAL_WHY } from './index.refusal.js';

describe('index.refusal', () => {
    test('refusal — a refusal — the lesson the runtime throws — states the case, the row’s sentence and the row’s heading, a part per line', () => {
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
                'read: docs/19-linting.md#disk-named-by-relative-path-at-runtime',
            ].join('\n'),
        );
        expect(lessonParts(message)?.read).toBe(
            'docs/19-linting.md#disk-named-by-relative-path-at-runtime',
        );
    });

    test('refusal — a refusal read in its chapter — states its four parts in their order, the read the heading that explains it', () => {
        // Given - a refusal no catalogue row owns, read in the chapter of its verb
        const message = refusal({
            fix: "take one first: using _ = clock.at('2026-03-04T09:30:00Z')",
            found: 'clock.advance(), and no clock is pinned',
            read: 'docs/05-module-tests.md#time',
            why: 'A clock moves only once it is pinned.',
        });

        // Then - four lines, found first and read last
        expect(message).toBe(
            [
                'found: clock.advance(), and no clock is pinned',
                'why: A clock moves only once it is pinned.',
                "fix: take one first: using _ = clock.at('2026-03-04T09:30:00Z')",
                'read: docs/05-module-tests.md#time',
            ].join('\n'),
        );
    });

    test('refusal — a refusal of a row handed no case — throws rather than print an empty found and fix', () => {
        // Given - an untyped caller naming a row and nothing else
        const row = ['disk-named-by-relative-path-at-runtime'];

        // Then - refused, naming the row it was handed
        expect(() => {
            Reflect.apply(refusal, undefined, row);
        }).toThrow(
            "refusal('disk-named-by-relative-path-at-runtime') was handed no found and no fix for its case",
        );
    });
});
