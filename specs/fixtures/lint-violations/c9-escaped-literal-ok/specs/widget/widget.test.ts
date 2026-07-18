import { describe, expect, test } from 'vitest';

import { text } from '../../setup/text.specification.js';

describe('widget', () => {
    test('golden absorbs an escaped-newline message', () => {
        // Given - an escaped-newline literal precedes the fixture reference on ONE line
        //         (the greedy pre-fix regex mis-consumed the reference's opening quote,
        //          dropping `used.txt` from the collected set → a false dead-fixture error)
        // Then - the golden reference is still seen
        expect(text('operation failed\n')).toMatch('used.txt');
    });
});
