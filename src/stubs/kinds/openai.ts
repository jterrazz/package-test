import type { StubRequest, StubResponse } from '../exchange.js';
import type { Stub } from '../stub.js';
import { http } from './http.js';
import type { SseEvent } from './http.js';
import { fieldOf, listOf, matchesText, messageText, namesOf, textOf } from './text-filter.js';
import type { TextFilter } from './text-filter.js';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

export type OpenAIChatFilter = {
    model?: TextFilter;
    system?: TextFilter;
    user?: TextFilter;
    tools?: string[];
    temperature?: number;
};

function matchesChatFilter(body: unknown, filter: OpenAIChatFilter): boolean {
    const messages = fieldOf(body, 'messages');
    const names = namesOf(fieldOf(body, 'tools'), (tool) =>
        fieldOf(fieldOf(tool, 'function'), 'name'),
    );
    return (
        matchesText(filter.model, textOf(fieldOf(body, 'model'))) &&
        matchesText(filter.system, messageText(messages, 'system')) &&
        matchesText(filter.user, messageText(messages, 'user')) &&
        (filter.tools?.every((tool) => names.includes(tool)) ?? true) &&
        (filter.temperature === undefined || fieldOf(body, 'temperature') === filter.temperature)
    );
}

export type OpenAIResponsesFilter = {
    model?: TextFilter;
    system?: TextFilter;
    user?: TextFilter;
    tools?: string[];
};

function matchesResponsesFilter(body: unknown, filter: OpenAIResponsesFilter): boolean {
    const input = fieldOf(body, 'input');
    const instructions = textOf(fieldOf(body, 'instructions'));
    const userText = listOf(input)
        .filter((message) => fieldOf(message, 'role') === 'user')
        .map((message) => {
            const content = fieldOf(message, 'content');
            return typeof content === 'string' ? content : JSON.stringify(content);
        })
        .join(' ');
    const names = namesOf(
        fieldOf(body, 'tools'),
        (tool) => fieldOf(tool, 'name') ?? fieldOf(fieldOf(tool, 'function'), 'name'),
    );
    return (
        matchesText(filter.model, textOf(fieldOf(body, 'model'))) &&
        matchesText(
            filter.system,
            instructions === '' ? messageText(input, 'system') : instructions,
        ) &&
        matchesText(filter.user, userText) &&
        (filter.tools?.every((tool) => names.includes(tool)) ?? true)
    );
}

function buildChatReply(data: unknown): StubResponse {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    return {
        status: 200,
        body: {
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: 'gpt-4o-test',
            choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        },
    };
}

type Usage = NonNullable<OpenAIStreamInit['usage']>;

function responsesEnvelope(text: string, usage: Usage = DEFAULT_USAGE): Record<string, unknown> {
    return {
        id: 'resp-test',
        object: 'response',
        created_at: Math.floor(Date.now() / 1000),
        model: 'gpt-4o-test',
        output: [
            {
                type: 'message',
                id: 'msg-test',
                role: 'assistant',
                content: [{ type: 'output_text', text, annotations: [] }],
            },
        ],
        usage: {
            input_tokens: usage.promptTokens,
            output_tokens: usage.completionTokens,
            total_tokens: usage.promptTokens + usage.completionTokens,
        },
    };
}

function buildResponsesReply(data: unknown): StubResponse {
    return {
        status: 200,
        body: responsesEnvelope(typeof data === 'string' ? data : JSON.stringify(data)),
    };
}

export type OpenAIStreamInit = {
    /** The API whose stream is served: Chat Completions (default) or Responses. */
    api?: 'chat' | 'responses';
    /** Milliseconds between two events. Default 0: every event at once. */
    delay?: number;
    /** The tokens the stream reports it spent: a Chat Completions stream ends on a usage chunk, as `stream_options.include_usage` asks, and a Responses stream carries them in its completed response. Default 10 and 10. */
    usage?: { completionTokens: number; promptTokens: number };
};

const DEFAULT_USAGE = { completionTokens: 10, promptTokens: 10 };

// invariant: one unnamed `chat.completion.chunk` per event: role, one delta per piece, finish reason, the usage chunk where tokens are stated, then `[DONE]`.
function chatStreamEvents(pieces: readonly string[], usage: undefined | Usage): SseEvent[] {
    const created = Math.floor(Date.now() / 1000);
    const chunk = (delta: object, finishReason: null | string): SseEvent => ({
        data: {
            id: 'chatcmpl-test',
            object: 'chat.completion.chunk',
            created,
            model: 'gpt-4o-test',
            choices: [{ index: 0, delta, logprobs: null, finish_reason: finishReason }],
        },
    });
    return [
        chunk({ role: 'assistant', content: '' }, null),
        ...pieces.map((piece) => chunk({ content: piece }, null)),
        chunk({}, 'stop'),
        ...(usage === undefined
            ? []
            : [
                  {
                      data: {
                          id: 'chatcmpl-test',
                          object: 'chat.completion.chunk',
                          created,
                          model: 'gpt-4o-test',
                          choices: [],
                          usage: {
                              prompt_tokens: usage.promptTokens,
                              completion_tokens: usage.completionTokens,
                              total_tokens: usage.promptTokens + usage.completionTokens,
                          },
                      },
                  },
              ]),
        { data: '[DONE]' },
    ];
}

// invariant: named, numbered events: response and message opened, one `response.output_text.delta` per piece, parts closed, `response.completed`.
function responsesStreamEvents(pieces: readonly string[], usage: undefined | Usage): SseEvent[] {
    const text = pieces.join('');
    const part = { type: 'output_text', text, annotations: [] };
    const item = { id: 'msg-test', type: 'message', role: 'assistant' };
    const done = { ...item, status: 'completed', content: [part] };
    const completed = { ...responsesEnvelope(text, usage), status: 'completed' };
    const at = { item_id: 'msg-test', output_index: 0, content_index: 0 };
    const bodies: { [field: string]: unknown; type: string }[] = [
        {
            type: 'response.created',
            response: { ...completed, status: 'in_progress', output: [], usage: null },
        },
        {
            type: 'response.output_item.added',
            output_index: 0,
            item: { ...item, status: 'in_progress', content: [] },
        },
        { type: 'response.content_part.added', ...at, part: { ...part, text: '' } },
        ...pieces.map((delta) => ({ type: 'response.output_text.delta', ...at, delta })),
        { type: 'response.output_text.done', ...at, text },
        { type: 'response.content_part.done', ...at, part },
        { type: 'response.output_item.done', output_index: 0, item: done },
        { type: 'response.completed', response: { ...completed, output: [done] } },
    ];
    return bodies.map((body, index) => ({
        data: { ...body, sequence_number: index },
        event: body.type,
    }));
}

/** OpenAI API stub helpers. */
export const openai = {
    /** Match Chat Completions calls, at `url` where the client reaches another host; a string filter is exact equality, a RegExp or `match.includes` loosens it. */
    chat(filter?: OpenAIChatFilter, url?: string): StubRequest {
        return {
            adapter: 'openai',
            method: 'POST',
            url: url ?? OPENAI_CHAT_URL,
            match: filter ? ({ body }) => matchesChatFilter(body, filter) : undefined,
            wrap: buildChatReply,
        };
    },

    /** Match Responses API calls; a JSON file is wrapped in the Responses envelope. */
    responses(filter?: OpenAIResponsesFilter, url?: string): StubRequest {
        return {
            adapter: 'openai',
            method: 'POST',
            url: url ?? OPENAI_RESPONSES_URL,
            match: filter ? ({ body }) => matchesResponsesFilter(body, filter) : undefined,
            wrap: buildResponsesReply,
        };
    },

    /** A stub the chain fails on if the subject reaches this endpoint: `http.never()`. */
    never(request: StubRequest): Stub {
        return http.never(request);
    },

    /** Response: data wrapped in the Chat Completions format. */
    reply(data: unknown): StubResponse {
        return buildChatReply(data);
    },

    /** Response: the text streamed as server-sent events; `api` picks Chat Completions (default) or Responses. */
    stream(pieces: readonly string[], init?: OpenAIStreamInit): StubResponse {
        const events =
            init?.api === 'responses'
                ? responsesStreamEvents(pieces, init.usage)
                : chatStreamEvents(pieces, init?.usage);
        return http.sse(events, { delay: init?.delay ?? 0 });
    },

    /** Response: return an OpenAI error. */
    error(status: number, message?: string): StubResponse {
        return {
            status,
            body: {
                error: {
                    message: message ?? `OpenAI error (${status})`,
                    type: status === 429 ? 'rate_limit_error' : 'api_error',
                    code: status === 429 ? 'rate_limit_exceeded' : null,
                },
            },
        };
    },

    /** Response: return malformed content. */
    malformed(content: string): StubResponse {
        return buildChatReply(content);
    },

    /** Response: simulate a timeout. */
    timeout(): StubResponse {
        return { status: 200, body: {}, delay: 30_000 };
    },
};
