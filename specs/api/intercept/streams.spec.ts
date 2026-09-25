import { describe, expect, test } from 'vitest';

import { http } from '../../../src/index.js';
import { api, STREAM_URL } from '../intercepts.specification.js';
import { chatHello, messagesHello, responsesHello } from './stubs/assistants.stubs.js';

describe('streams', () => {
    test('the app reads the declared pieces, in the declared order', async () => {
        // Given - a provider declared to answer in three pieces
        const result = await api
            .intercept(
                http.get(STREAM_URL),
                http.stream(['Hel', 'lo, ', 'world'], { contentType: 'text/plain' }),
            )
            .get('/tokens');

        // Then - the app read them one by one, under the declared type
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "chunks": [
                    "Hel",
                    "lo, ",
                    "world"
                ],
                "contentType": "text/plain"
            }
        `);
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
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "chunks": [
                    "data: {\\"token\\":\\"a\\"}\\n\\n",
                    "event: done\\ndata: \\n\\n"
                ],
                "contentType": "text/event-stream"
            }
        `);
    });

    test('an OpenAI chat reply streams as chunks an SSE client assembles, closed by [DONE]', async () => {
        // Given - OpenAI declared to stream a greeting in three pieces on the Chat Completions wire
        const result = await api.intercept(chatHello).get('/assistant/openai-chat');

        // Then - the app read every delta in order and saw the sentinel last
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "closedBy": "[DONE]",
                "text": "Hello, world"
            }
        `);
    });

    test('an OpenAI Responses reply streams as named events, closed by response.completed', async () => {
        // Given - OpenAI declared to stream the same greeting on the Responses wire
        const result = await api.intercept(responsesHello).get('/assistant/openai-responses');

        // Then - the app assembled the output-text deltas and saw the completion last
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "closedBy": "response.completed",
                "text": "Hello, world"
            }
        `);
    });

    test('an Anthropic reply streams as Messages events, closed by message_stop', async () => {
        // Given - Anthropic declared to stream the greeting
        const result = await api.intercept(messagesHello).get('/assistant/anthropic');

        // Then - the app assembled the text deltas and saw the stop last
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "closedBy": "message_stop",
                "text": "Hello, world"
            }
        `);
    });
});
