import { describe, expect, test } from 'vitest';

import { isStreamBody, STREAM_BODY } from '../exchange.js';

describe('exchange', () => {
    test('exchange — a stream body — is known by its kind alone', () => {
        // Given - a stream body, an object of another kind, and values that are no object
        // Then - only the stream is one
        expect(
            [{ chunks: [], kind: STREAM_BODY }, { kind: 'json' }, null, 'stream'].map(isStreamBody),
        ).toStrictEqual([true, false, false, false]);
    });
});
