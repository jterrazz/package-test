import { describe, expect, test } from 'vitest';

import { text } from '../text-subject.js';

describe('text', () => {
    test('text-subject — a string as a subject — read as itself, named text, anchored on the calling test', () => {
        // Given - a string made a subject
        const subject = text('hello');

        // Then - its text, its name, and the folder of this test
        expect([subject.text, subject.streamName, subject.testDir]).toStrictEqual([
            'hello',
            'text',
            import.meta.dirname,
        ]);
    });
});
