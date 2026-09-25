import type { StubRequest, StubResponse } from '../exchange.js';
import { matchesText } from '../filters.js';
import type { TextFilter } from '../filters.js';
import { http } from '../http/http.js';
import type { SseEvent } from '../http/http.js';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

export type AnthropicMessagesFilter = {
    model?: TextFilter;
    system?: TextFilter;
    user?: TextFilter;
    tools?: string[];
};

function matchesFilter(body: any, filter: AnthropicMessagesFilter): boolean {
    if (!matchesText(filter.model, body?.model ?? '')) {
        return false;
    }
    if (!matchesText(filter.system, typeof body?.system === 'string' ? body.system : '')) {
        return false;
    }
    const userMsg = body?.messages?.find((m: any) => m.role === 'user')?.content ?? '';
    if (
        !matchesText(filter.user, typeof userMsg === 'string' ? userMsg : JSON.stringify(userMsg))
    ) {
        return false;
    }
    if (filter.tools) {
        const names = body?.tools?.map((t: any) => t.name).filter(Boolean) ?? [];
        if (!filter.tools.every((t) => names.includes(t))) {
            return false;
        }
    }
    return true;
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

/**
 * A Messages stream: named events — the message and its one text block
 * opened, a `ping`, one `text_delta` per piece, the block closed, the stop
 * reason, and `message_stop` last.
 */
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

/**
 * Anthropic API intercept helpers.
 */
export const anthropic = {
    /**
     * Request: match Messages API calls, optionally routed through a
     * custom gateway URL. When used with a JSON fixture file, the data is
     * returned as-is (no wrapping) because Anthropic fixtures are typically
     * already in the Messages API response shape.
     *
     * @example
     *   anthropic.messages()
     *   anthropic.messages({ system: /classify/ })
     *   anthropic.messages({ user: buildPrompt() })   // string = EXACT equality
     *   anthropic.messages({ user: /classify/ }, GATEWAY)
     */
    messages(filter?: AnthropicMessagesFilter, url?: string): StubRequest {
        return {
            adapter: 'anthropic',
            method: 'POST',
            url: url ?? ANTHROPIC_MESSAGES_URL,
            match: filter ? ({ body }) => matchesFilter(body, filter) : undefined,
            // Fixture files are already in the messages.create response shape;
            // Pass them through verbatim. Falls back to wrapping for strings.
            wrap(data: unknown): StubResponse {
                if (data && typeof data === 'object' && !Array.isArray(data)) {
                    return { status: 200, body: data };
                }
                return buildReply(data);
            },
        };
    },

    /** Response: wrap data in Anthropic messages format. */
    reply(data: unknown): StubResponse {
        return buildReply(data);
    },

    /**
     * Response: the assistant's text STREAMED, as the Messages API serves it
     * with `stream: true` — server-sent events under `text/event-stream`, one
     * `text_delta` per piece, in order, closed by `message_stop`.
     *
     * @example
     *   defineStub({ request: anthropic.messages(), response: anthropic.stream(['Hel', 'lo']) })
     */
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
