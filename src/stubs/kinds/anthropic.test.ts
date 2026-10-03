import { describe, expect, test } from 'vitest';

import { isStreamBody } from '../exchange.js';
import type { StubRequest } from '../exchange.js';
import { anthropic } from './anthropic.js';

function matcherOf(declared: StubRequest): NonNullable<StubRequest['match']> {
    const matcher = declared.match;
    if (matcher === undefined) {
        throw new Error('the builder declared no matcher');
    }
    return matcher;
}

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

function frame(data: { [field: string]: unknown; type: string }): string {
    return `event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`;
}
function shapeOf(request: StubRequest): object {
    return { ...request, match: typeof request.match, wrap: typeof request.wrap };
}

const envelope = (text: string): object => ({
    body: {
        content: [{ text, type: 'text' }],
        id: 'msg-test',
        model: 'claude-sonnet-4-20250514',
        role: 'assistant',
        stop_reason: 'end_turn',
        type: 'message',
        usage: { input_tokens: 10, output_tokens: 10 },
    },
    status: 200,
});

describe('anthropic', () => {
    test('intercept — anthropic — anthropic.messages() filter matches system prompt', () => {
        // Given - a system-prompt filter, and two requests
        const trigger = anthropic.messages({ system: /journal/u });
        const asked = (system: string): boolean =>
            matcherOf(trigger)({
                body: {
                    messages: [{ content: 'hi', role: 'user' }],
                    model: 'claude-sonnet-4-20250514',
                    system,
                },
                headers: {},
                method: 'POST',
                url: ANTHROPIC_MESSAGES_URL,
            });

        // Then - only the body with a matching system prompt passes
        expect({
            coding: asked('You are a coding agent.'),
            journal: asked('You are a journal agent.'),
        }).toStrictEqual({ coding: false, journal: true });
    });

    test('intercept — anthropic — anthropic.messages() filter matches first user message', () => {
        // Given - a user-message filter, and two requests
        const trigger = anthropic.messages({ user: /classify/u });
        const asked = (content: string): boolean =>
            matcherOf(trigger)({
                body: { messages: [{ content, role: 'user' }] },
                headers: {},
                method: 'POST',
                url: ANTHROPIC_MESSAGES_URL,
            });

        // Then - only the body whose first user message matches passes
        expect({
            classify: asked('Please classify this article'),
            greeting: asked('hello'),
        }).toStrictEqual({ classify: true, greeting: false });
    });

    test('intercept — anthropic — anthropic.messages() wrap passes fixture objects through verbatim, and builds the envelope around a string', () => {
        // Given - a full response fixture object, and a plain string
        const trigger = anthropic.messages();
        const fixture = {
            content: [{ text: 'hi there', type: 'text' }],
            id: 'msg_123',
            model: 'claude-sonnet-4-20250514',
            role: 'assistant',
            stop_reason: 'end_turn',
            type: 'message',
            usage: { input_tokens: 1, output_tokens: 2 },
        };

        // Then - the object is the reply, untouched; the string becomes a whole message
        expect([trigger.wrap([1, 2]), trigger.wrap(null)]).toStrictEqual([
            envelope('[1,2]'),
            envelope('null'),
        ]);
        expect([trigger.wrap(fixture), trigger.wrap('plain text reply')]).toStrictEqual([
            { body: fixture, status: 200 },
            {
                body: {
                    content: [{ text: 'plain text reply', type: 'text' }],
                    id: 'msg-test',
                    model: 'claude-sonnet-4-20250514',
                    role: 'assistant',
                    stop_reason: 'end_turn',
                    type: 'message',
                    usage: { input_tokens: 10, output_tokens: 10 },
                },
                status: 200,
            },
        ]);
    });

    test('intercept — anthropic — anthropic.messages() model filter matches by exact string equality', () => {
        // Given - a string model filter (not a RegExp)
        const trigger = anthropic.messages({ model: 'claude-sonnet-4-20250514' });
        const asked = (model: string): boolean =>
            matcherOf(trigger)({
                body: { messages: [{ content: 'hi', role: 'user' }], model },
                headers: {},
                method: 'POST',
                url: ANTHROPIC_MESSAGES_URL,
            });

        // Then - only the exact model passes; a prefix or a different model does not
        expect({
            exact: asked('claude-sonnet-4-20250514'),
            other: asked('claude-opus-4-20250514'),
            prefix: asked('claude-sonnet-4'),
        }).toStrictEqual({ exact: true, other: false, prefix: false });
    });

    test('intercept — anthropic — anthropic.messages() tools filter matches a subset of declared tool names', () => {
        // Given - a filter requiring one tool by name
        const trigger = anthropic.messages({ tools: ['get_weather'] });
        const asked = (names: string[], filtered = trigger): boolean =>
            matcherOf(filtered)({
                body: {
                    messages: [{ content: 'hi', role: 'user' }],
                    tools: names.map((name) => ({ name })),
                },
                headers: {},
                method: 'POST',
                url: ANTHROPIC_MESSAGES_URL,
            });

        // Then - present (even among others) passes; absent or no tools fails
        expect({
            absent: asked(['get_time']),
            among: asked(['get_weather', 'get_time']),
            none: asked([]),
            oneOfTwo: asked(
                ['get_weather'],
                anthropic.messages({ tools: ['get_weather', 'get_time'] }),
            ),
        }).toStrictEqual({ absent: false, among: true, none: false, oneOfTwo: false });
    });

    test('intercept — anthropic — anthropic.messages() string-form system/user filters match by EXACT equality', () => {
        // Given - string (not RegExp) system and user filters
        const trigger = anthropic.messages({
            system: 'You are a journal agent.',
            user: 'please classify this',
        });
        const asked = (system: string, user: string): boolean =>
            matcherOf(trigger)({
                body: { messages: [{ content: user, role: 'user' }], system },
                headers: {},
                method: 'POST',
                url: ANTHROPIC_MESSAGES_URL,
            });

        // Then - both must match whole; a superstring is no match
        expect({
            exact: asked('You are a journal agent.', 'please classify this'),
            otherSystem: asked('You are a coding agent.', 'please classify this'),
            superstring: asked('You are a journal agent.', 'please classify this article'),
        }).toStrictEqual({ exact: true, otherSystem: false, superstring: false });
    });

    test('intercept — anthropic — anthropic.error() returns rate_limit_error for 429 and api_error otherwise, and timeout() a reply delayed past any client', () => {
        // Given - a 429, a 500 with its message, and a simulated timeout
        // Then - each is the whole reply: the status, the error type the code calls for, the delay
        expect([
            anthropic.error(429),
            anthropic.error(500, 'overloaded'),
            anthropic.timeout(),
        ]).toStrictEqual([
            {
                body: {
                    error: { message: 'Anthropic error (429)', type: 'rate_limit_error' },
                    type: 'error',
                },
                status: 429,
            },
            {
                body: { error: { message: 'overloaded', type: 'api_error' }, type: 'error' },
                status: 500,
            },
            { body: {}, delay: 30_000, status: 200 },
        ]);
    });

    test('intercept — anthropic streamed replies — stream() serves the Messages events — one text_delta per piece — closed by message_stop', () => {
        // Given - two pieces
        const response = anthropic.stream(['Hel', 'lo'], { delay: 5 });
        if (!isStreamBody(response.body)) {
            throw new Error('the reply is not a stream');
        }

        // Then - each event is named for its type, the deltas are the pieces in order, and the stream ends on message_stop
        expect(response.body.chunks).toStrictEqual([
            frame({
                type: 'message_start',
                message: {
                    id: 'msg-test',
                    type: 'message',
                    role: 'assistant',
                    content: [],
                    model: 'claude-sonnet-4-20250514',
                    stop_reason: null,
                    stop_sequence: null,
                    usage: { input_tokens: 10, output_tokens: 1 },
                },
            }),
            frame({
                type: 'content_block_start',
                index: 0,
                content_block: { type: 'text', text: '' },
            }),
            frame({ type: 'ping' }),
            frame({
                type: 'content_block_delta',
                index: 0,
                delta: { type: 'text_delta', text: 'Hel' },
            }),
            frame({
                type: 'content_block_delta',
                index: 0,
                delta: { type: 'text_delta', text: 'lo' },
            }),
            frame({ type: 'content_block_stop', index: 0 }),
            frame({
                type: 'message_delta',
                delta: { stop_reason: 'end_turn', stop_sequence: null },
                usage: { output_tokens: 10 },
            }),
            frame({ type: 'message_stop' }),
        ]);
        expect({
            contentType: response.body.contentType,
            delay: response.body.delayBetweenChunks,
            headers: response.headers,
            status: response.status,
        }).toStrictEqual({
            contentType: 'text/event-stream',
            delay: 5,
            headers: { 'cache-control': 'no-cache' },
            status: 200,
        });
    });

    test('anthropic — never — never() is http.never() spelled in this kind, over the endpoint it is handed', () => {
        // Given - the provider call a cached path must not make
        const declared = anthropic.never(anthropic.messages());

        // Then - a stub required exactly zero times on that endpoint
        expect({ ...declared, request: shapeOf(declared.request) }).toStrictEqual({
            request: {
                adapter: 'anthropic',
                match: 'undefined',
                method: 'POST',
                url: ANTHROPIC_MESSAGES_URL,
                wrap: 'function',
            },
            required: true,
            response: {
                body: {
                    error: `@jterrazz/test: POST ${ANTHROPIC_MESSAGES_URL} is declared never requested`,
                },
                status: 418,
            },
            times: 0,
        });
    });

    test('intercept — anthropic streamed replies — stream() with no init serves every event at once', () => {
        // Given - a stream declared with no delay
        const { body } = anthropic.stream(['a']);

        // Then - no pause between two events
        expect(isStreamBody(body) ? body.delayBetweenChunks : undefined).toBe(0);
    });
});
