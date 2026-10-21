import { pause } from '../../chain/pause.js';
import type { MatchableRequest, StubResponse } from '../exchange.js';
import type { Stub } from '../stub.js';

/** A request's body as a stub's filter reads it: the parsed JSON, the raw text when it is none, `null` when there is none. */
export function requestBody(raw: string): unknown {
    if (raw.length === 0) {
        return null;
    }
    try {
        return JSON.parse(raw) as unknown;
    } catch {
        return raw;
    }
}

/** The reply a matched stub states for this request, once its delay has passed. */
export async function replyOf(
    response: Stub['response'],
    observed: MatchableRequest,
): Promise<StubResponse> {
    const reply = typeof response === 'function' ? response(observed) : response;
    await pause(reply.delay ?? 0);
    return reply;
}

/** The `error` of the 501 every delivery answers a request it refuses, whichever process serves it. */
export function refusedReply(summary: string): string {
    return `@jterrazz/test strict stubs: ${summary}`;
}

export function unmatchedSummary(method: string, url: string): string {
    return `unmatched request ${method} ${url}`;
}
