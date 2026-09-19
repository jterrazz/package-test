import { describe, expect, test } from 'vitest';

import { http } from '../../../src/index.js';
import { api, STREAM_URL } from '../intercepts.specification.js';

describe('contracts — streamed replies', () => {
    test('the app reads the declared pieces, in the declared order', async () => {
        // Given - a provider declared to answer in three pieces
        const result = await api
            .intercept(
                http.get(STREAM_URL),
                http.stream(['Hel', 'lo, ', 'world'], { contentType: 'text/plain' }),
            )
            .get('/tokens');

        // Then - the app read them one by one, under the declared type
        expect(result.response.body).toStrictEqual({
            chunks: ['Hel', 'lo, ', 'world'],
            contentType: 'text/plain',
        });
    });

    test('an event stream arrives framed, one chunk per event', async () => {
        // Given - a provider declared to answer with server-sent events
        const result = await api
            .intercept(
                http.get(STREAM_URL),
                http.sse([{ data: { token: 'a' } }, { data: '', event: 'done' }]),
            )
            .get('/tokens');

        // Then - each event is its own frame, under text/event-stream
        expect(result.response.body).toStrictEqual({
            chunks: ['data: {"token":"a"}\n\n', 'event: done\ndata: \n\n'],
            contentType: 'text/event-stream',
        });
    });
});
