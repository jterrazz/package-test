import type { InterceptResponse, InterceptTrigger } from './types.js';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

export interface AnthropicMessagesFilter {
    /** Match by model name. */
    model?: RegExp | string;
    /** Match by system message content. */
    system?: RegExp | string;
    /** Match by user message content. */
    user?: RegExp | string;
    /** Match by tool names. */
    tools?: string[];
}

function matchesFilter(body: any, filter: AnthropicMessagesFilter): boolean {
    if (filter.model) {
        const model = body?.model;
        if (typeof filter.model === 'string' && model !== filter.model) {
            return false;
        }
        if (filter.model instanceof RegExp && !filter.model.test(model ?? '')) {
            return false;
        }
    }

    if (filter.system) {
        const system = typeof body?.system === 'string' ? body.system : '';
        if (typeof filter.system === 'string' && !system.includes(filter.system)) {
            return false;
        }
        if (filter.system instanceof RegExp && !filter.system.test(system)) {
            return false;
        }
    }

    if (filter.user) {
        const userMsg = body?.messages?.find((m: any) => m.role === 'user')?.content ?? '';
        const text = typeof userMsg === 'string' ? userMsg : JSON.stringify(userMsg);
        if (typeof filter.user === 'string' && !text.includes(filter.user)) {
            return false;
        }
        if (filter.user instanceof RegExp && !filter.user.test(text)) {
            return false;
        }
    }

    if (filter.tools) {
        const requestTools = body?.tools?.map((t: any) => t.name).filter(Boolean) ?? [];
        if (!filter.tools.every((t) => requestTools.includes(t))) {
            return false;
        }
    }

    return true;
}

/**
 * Anthropic API intercept helpers.
 */
export const anthropic = {
    /**
     * Trigger: match Anthropic messages API requests.
     */
    messages(filter?: AnthropicMessagesFilter): InterceptTrigger {
        return {
            method: 'POST',
            url: ANTHROPIC_MESSAGES_URL,
            match: filter ? (body: unknown) => matchesFilter(body, filter) : undefined,
        };
    },

    /** Response: wrap data in Anthropic messages format. */
    response(data: unknown): InterceptResponse {
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
    },

    /** Response: return an Anthropic error. */
    error(status: number, message?: string): InterceptResponse {
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
    timeout(): InterceptResponse {
        return { status: 200, body: {}, delay: 30_000 };
    },
};
