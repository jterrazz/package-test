import { matchesText, type TextFilter } from '../../core/contracts/filters.js';
import type { ContractRequest, ContractResponse } from '../../core/contracts/types.js';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

export interface AnthropicMessagesFilter {
    model?: TextFilter;
    system?: TextFilter;
    user?: TextFilter;
    tools?: string[];
}

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

function buildReply(data: unknown): ContractResponse {
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
    messages(filter?: AnthropicMessagesFilter, url?: string): ContractRequest {
        return {
            adapter: 'anthropic',
            method: 'POST',
            url: url ?? ANTHROPIC_MESSAGES_URL,
            match: filter ? ({ body }) => matchesFilter(body, filter) : undefined,
            // Fixture files are already in the messages.create response shape;
            // Pass them through verbatim. Falls back to wrapping for strings.
            wrap(data: unknown): ContractResponse {
                if (data && typeof data === 'object' && !Array.isArray(data)) {
                    return { status: 200, body: data as Record<string, unknown> };
                }
                return buildReply(data);
            },
        };
    },

    /** Response: wrap data in Anthropic messages format. */
    reply: buildReply,

    /** Response: return an Anthropic error. */
    error(status: number, message?: string): ContractResponse {
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
    timeout(): ContractResponse {
        return { status: 200, body: {}, delay: 30_000 };
    },
};
