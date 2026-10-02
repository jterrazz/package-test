import { describe, expect, test } from 'vitest';

import { clock } from '../../clock/clock.js';
import type { StubRequest } from '../exchange.js';
import { isStreamBody } from '../exchange.js';
import { openai } from './openai.js';

const CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const RESPONSES_URL = 'https://api.openai.com/v1/responses';

function lets(trigger: StubRequest, body: unknown, url = CHAT_URL): boolean | undefined {
    return trigger.match?.({ body, headers: {}, method: 'POST', url });
}

function chatBody(model: string, system: string, user: string): unknown {
    return {
        messages: [
            { content: system, role: 'system' },
            { content: user, role: 'user' },
        ],
        model,
    };
}

function toolsBody(names: string[], temperature: number): unknown {
    return {
        messages: [{ content: 'hi', role: 'user' }],
        temperature,
        tools: names.map((name) => ({ function: { name }, type: 'function' })),
    };
}

function responsesBody(tool: unknown): unknown {
    return {
        input: [
            { content: 'Run the', role: 'user' },
            { content: 'Report Ingestion', role: 'user' },
        ],
        tools: [tool],
    };
}

function chatCompletion(content: string): object {
    return {
        body: {
            choices: [{ finish_reason: 'stop', index: 0, message: { content, role: 'assistant' } }],
            created: 1_772_616_600,
            id: 'chatcmpl-test',
            model: 'gpt-4o-test',
            object: 'chat.completion',
            usage: { completion_tokens: 10, prompt_tokens: 10, total_tokens: 20 },
        },
        status: 200,
    };
}

function framesOf(body: unknown): { data: unknown; event: string | undefined }[] {
    if (!isStreamBody(body)) {
        throw new Error('the reply is not a stream');
    }
    return body.chunks.map((chunk) => {
        const lines = chunk.trimEnd().split('\n');
        const field = (name: string): string =>
            lines.find((line) => line.startsWith(`${name}: `))?.slice(name.length + 2) ?? '';
        return { data: JSON.parse(field('data')) as unknown, event: field('event') };
    });
}

function chatChunk(delta: object, finish: null | string): string {
    return `data: ${JSON.stringify({
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: 1_772_616_600,
        model: 'gpt-4o-test',
        choices: [{ index: 0, delta, logprobs: null, finish_reason: finish }],
    })}\n\n`;
}

const PART = { content_index: 0, item_id: 'msg-test', output_index: 0 };

const ENVELOPE = {
    created_at: 1_772_616_600,
    id: 'resp-test',
    model: 'gpt-4o-test',
    object: 'response',
};

const DONE = {
    content: [{ annotations: [], text: 'Hello', type: 'output_text' }],
    id: 'msg-test',
    role: 'assistant',
    status: 'completed',
    type: 'message',
};

function event(type: string, sequence: number, fields: object): object {
    return { data: { ...fields, sequence_number: sequence, type }, event: type };
}

describe('openai', () => {
    test('intercept — openai chat completions — string filters match by exact equality on the model and the first system and user messages', () => {
        // Given - exact model, system and user filters
        const trigger = openai.chat({ model: 'gpt-4o', system: 'Classify.', user: 'an article' });

        // Then - the whole triple passes; a prefix or a superstring of any part does not
        expect({
            exact: lets(trigger, chatBody('gpt-4o', 'Classify.', 'an article')),
            otherModel: lets(trigger, chatBody('gpt-4o-mini', 'Classify.', 'an article')),
            systemSuperstring: lets(trigger, chatBody('gpt-4o', 'Classify. Then', 'an article')),
            userSuperstring: lets(
                trigger,
                chatBody('gpt-4o', 'Classify.', 'an article about cats'),
            ),
        }).toStrictEqual({
            exact: true,
            otherModel: false,
            systemSuperstring: false,
            userSuperstring: false,
        });
    });

    test('intercept — openai chat completions — the tools filter reads function names, and the temperature filter is exact', () => {
        // Given - a filter on one tool and a temperature
        const trigger = openai.chat({ temperature: 0, tools: ['get_weather'] });

        // Then - the tool among others at the temperature passes; a missing tool or another temperature does not
        expect({
            among: lets(trigger, toolsBody(['get_time', 'get_weather'], 0)),
            missing: lets(trigger, toolsBody(['get_time'], 0)),
            warmer: lets(trigger, toolsBody(['get_weather'], 0.7)),
        }).toStrictEqual({ among: true, missing: false, warmer: false });
    });

    test('intercept — openai responses — the system filter reads the instructions, or a system input when there are none', () => {
        // Given - an exact system filter
        const trigger = openai.responses({ system: 'Summarise.' });

        // Then - instructions and a system input both answer; another prompt does not
        expect({
            instructions: lets(trigger, { input: [], instructions: 'Summarise.' }, RESPONSES_URL),
            other: lets(trigger, { input: [], instructions: 'Translate.' }, RESPONSES_URL),
            systemInput: lets(
                trigger,
                { input: [{ content: 'Summarise.', role: 'system' }] },
                RESPONSES_URL,
            ),
        }).toStrictEqual({ instructions: true, other: false, systemInput: true });
    });

    test('intercept — openai responses — the user filter reads every user input joined, and the tools filter either name form', () => {
        // Given - a pattern on the user text and a required tool
        const trigger = openai.responses({ tools: ['search'], user: /the Report Ingestion/u });

        // Then - a flat name and a function name both count; the user text is read across inputs
        expect({
            flat: lets(trigger, responsesBody({ name: 'search' }), RESPONSES_URL),
            function: lets(trigger, responsesBody({ function: { name: 'search' } }), RESPONSES_URL),
            other: lets(trigger, responsesBody({ name: 'fetch' }), RESPONSES_URL),
        }).toStrictEqual({ flat: true, function: true, other: false });
    });

    test('intercept — openai streamed replies — stream() serves Chat Completions chunks — the role, one delta per piece, the finish — closed by [DONE]', () => {
        // Given - two pieces, at a pinned instant
        using _ = clock.at('2026-03-04T09:30:00Z');
        const response = openai.stream(['Hel', 'lo']);

        // Then - one unnamed data frame per chunk, under text/event-stream, and the sentinel last
        expect(response).toStrictEqual({
            body: {
                chunks: [
                    chatChunk({ role: 'assistant', content: '' }, null),
                    chatChunk({ content: 'Hel' }, null),
                    chatChunk({ content: 'lo' }, null),
                    chatChunk({}, 'stop'),
                    'data: [DONE]\n\n',
                ],
                contentType: 'text/event-stream',
                delayBetweenChunks: 0,
                kind: '@jterrazz/test:stream',
            },
            headers: { 'cache-control': 'no-cache' },
            status: 200,
        });
    });

    test('intercept — openai streamed replies — stream() on the Responses API serves named, numbered events, one text delta per piece, completed last', () => {
        // Given - two pieces on the Responses wire, spaced 5 ms apart, at a pinned instant
        using _ = clock.at('2026-03-04T09:30:00Z');
        const response = openai.stream(['Hel', 'lo'], { api: 'responses', delay: 5 });

        // Then - every event is named for its type and numbered in order; the deltas are the pieces, the closing events carry the whole text
        expect({
            delay: isStreamBody(response.body) && response.body.delayBetweenChunks,
            frames: framesOf(response.body),
        }).toStrictEqual({
            delay: 5,
            frames: [
                event('response.created', 0, {
                    response: { ...ENVELOPE, output: [], status: 'in_progress', usage: null },
                }),
                event('response.output_item.added', 1, {
                    item: {
                        content: [],
                        id: 'msg-test',
                        role: 'assistant',
                        status: 'in_progress',
                        type: 'message',
                    },
                    output_index: 0,
                }),
                event('response.content_part.added', 2, {
                    ...PART,
                    part: { annotations: [], text: '', type: 'output_text' },
                }),
                event('response.output_text.delta', 3, { ...PART, delta: 'Hel' }),
                event('response.output_text.delta', 4, { ...PART, delta: 'lo' }),
                event('response.output_text.done', 5, { ...PART, text: 'Hello' }),
                event('response.content_part.done', 6, {
                    ...PART,
                    part: { annotations: [], text: 'Hello', type: 'output_text' },
                }),
                event('response.output_item.done', 7, { item: DONE, output_index: 0 }),
                event('response.completed', 8, {
                    response: {
                        ...ENVELOPE,
                        output: [DONE],
                        status: 'completed',
                        usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
                    },
                }),
            ],
        });
    });

    test('intercept — openai replies — the wraps, openai.reply() and openai.malformed() build the reply each API reads around the data', () => {
        // Given - an object wrapped by the trigger, a text by reply(), broken content by malformed(), at a pinned instant
        using _ = clock.at('2026-03-04T09:30:00Z');
        const replies = [
            openai.chat().wrap({ categories: ['TECH'] }),
            openai.reply('plain text'),
            openai.malformed('{not json'),
        ];

        // Then - the data is the assistant's content, serialised when it is not a string, carried as is when broken
        expect([...replies, openai.responses().wrap({ ok: true })]).toStrictEqual([
            chatCompletion('{"categories":["TECH"]}'),
            chatCompletion('plain text'),
            chatCompletion('{not json'),
            {
                body: {
                    created_at: 1_772_616_600,
                    id: 'resp-test',
                    model: 'gpt-4o-test',
                    object: 'response',
                    output: [
                        {
                            content: [
                                { annotations: [], text: '{"ok":true}', type: 'output_text' },
                            ],
                            id: 'msg-test',
                            role: 'assistant',
                            type: 'message',
                        },
                    ],
                    usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
                },
                status: 200,
            },
        ]);
    });

    test('intercept — openai failures — openai.error() is a rate limit on 429 and an api error otherwise, and openai.timeout() an empty 200 after 30 s', () => {
        // Given - a 429, a 500 and a timeout
        const failures = [openai.error(429), openai.error(500, 'overloaded'), openai.timeout()];

        // Then - the status carries through, the error type and code are the status's, and the timeout is delayed past any client
        expect(failures).toStrictEqual([
            {
                body: {
                    error: {
                        code: 'rate_limit_exceeded',
                        message: 'OpenAI error (429)',
                        type: 'rate_limit_error',
                    },
                },
                status: 429,
            },
            {
                body: { error: { code: null, message: 'overloaded', type: 'api_error' } },
                status: 500,
            },
            { body: {}, delay: 30_000, status: 200 },
        ]);
    });
});
