import { describe, expect, test } from 'vitest';

import { lessonParts } from './lesson-parts.js';
import { refusal, REFUSAL_WHY } from './refusal.js';

describe('refusal', () => {
    test('a refusal — the lesson the runtime throws — states the case, the row’s sentence and the row’s heading, a part per line', () => {
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
});
