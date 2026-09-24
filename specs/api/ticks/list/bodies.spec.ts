import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('bodies', () => {
    test('an event stream is compared as the text of its events, in order', async () => {
        // Given - an app whose route answers with two server-sent events
        const result = await api.get('/ticks');

        // Then - the whole response, its body every frame the stream wrote
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: text/event-stream

            data: {"tick":1}

            event: done
            data: over
        `);
    });
});
