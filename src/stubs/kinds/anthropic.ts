import type { StubRequest, StubResponse } from '../exchange.js';
import type { Stub } from '../stub.js';
import { http } from './http.js';
import type { SseEvent } from './http.js';
import { fieldOf, matchesText, messageText, namesOf, textOf } from './text-filter.js';
import type { TextFilter } from './text-filter.js';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

export type AnthropicMessagesFilter = {
    model?: TextFilter;
    system?: TextFilter;
    user?: TextFilter;
    tools?: string[];
};

function matchesFilter(body: unknown, filter: AnthropicMessagesFilter): boolean {
    const names = namesOf(fieldOf(body, 'tools'), (tool) => fieldOf(tool, 'name'));
    return (
        matchesText(filter.model, textOf(fieldOf(body, 'model'))) &&
        matchesText(filter.system, textOf(fieldOf(body, 'system'))) &&
        matchesText(filter.user, messageText(fieldOf(body, 'messages'), 'user')) &&
        (filter.tools?.every((tool) => names.includes(tool)) ?? true)
    );
}

function buildReply(data: unknown): StubResponse {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    return {
        status: 200,
        body: {
            id: 'msg-test',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: content }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 10 },
        },
    };
}

/** Init options for a streamed Anthropic reply. */
export type AnthropicStreamInit = {
    /** Milliseconds between two events. Default 0 — every event at once. */
    delay?: number;
};

/** Named events: message and text block opened, `ping`, one `text_delta` per piece, block closed, stop reason, `message_stop`. */
function streamEvents(pieces: readonly string[]): SseEvent[] {
    const bodies: { [field: string]: unknown; type: string }[] = [
        {
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
        },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'ping' },
        ...pieces.map((text) => ({
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text },
        })),
        { type: 'content_block_stop', index: 0 },
        {
            type: 'message_delta',
            delta: { stop_reason: 'end_turn', stop_sequence: null },
            usage: { output_tokens: 10 },
        },
        { type: 'message_stop' },
    ];
    return bodies.map((data) => ({ data, event: data.type }));
}

/** Anthropic API stub helpers. */
export const anthropic = {
    /** Match Messages API calls, optionally through a gateway URL; a string filter is exact equality. */
    messages(filter?: AnthropicMessagesFilter, url?: string): StubRequest {
        return {
            adapter: 'anthropic',
            method: 'POST',
            url: url ?? ANTHROPIC_MESSAGES_URL,
            match: filter ? ({ body }) => matchesFilter(body, filter) : undefined,
            // outside: fixture files are already in the messages.create shape: passed through verbatim.
            wrap(data: unknown): StubResponse {
                if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
                    return { status: 200, body: data };
                }
                return buildReply(data);
            },
        };
    },

    /** A stub the chain fails on if the subject reaches this endpoint: `http.never()`. */
    never(request: StubRequest): Stub {
        return http.never(request);
    },

    /** Response: data wrapped in the Messages format. */
    reply(data: unknown): StubResponse {
        return buildReply(data);
    },

    /** Response: the text streamed as server-sent events, one `text_delta` per piece. */
    stream(pieces: readonly string[], init?: AnthropicStreamInit): StubResponse {
        return http.sse(streamEvents(pieces), { delay: init?.delay ?? 0 });
    },

    /** Response: return an Anthropic error. */
    error(status: number, message?: string): StubResponse {
        return {
            status,
            body: {
                type: 'error',
                error: {
                    type: status === 429 ? 'rate_limit_error' : 'api_error',
                    message: message ?? `Anthropic error (${status})`,
                },
            },
        };
    },

    /** Response: simulate a timeout. */
    timeout(): StubResponse {
        return { status: 200, body: {}, delay: 30_000 };
    },
};
