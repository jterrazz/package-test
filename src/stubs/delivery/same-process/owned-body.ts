/** msw holds a second tee branch it never cancels, so the caller's branch could never settle a cancel; this stream settles at once. */

async function release(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    reason: unknown,
): Promise<void> {
    try {
        await reader.cancel(reason);
    } catch {
        // invariant: how msw's branch ends is not the subject's to hear.
    }
}

export function withOwnedBody(response: Response): Response {
    const { body } = response;
    if (body === null) {
        return response;
    }
    const reader = body.getReader();
    const owned = new ReadableStream<Uint8Array>({
        cancel: (reason) => {
            void release(reader, reason);
        },
        pull: async (controller) => {
            const { done, value } = await reader.read();
            if (done) {
                controller.close();
            } else {
                controller.enqueue(value);
            }
        },
    });
    const reply = new Response(owned, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
    });
    Object.defineProperties(reply, {
        redirected: { value: response.redirected },
        type: { value: response.type },
        url: { value: response.url },
    });
    return reply;
}

export function owningBodies(underlying: typeof fetch): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
        withOwnedBody(await underlying(input, init));
}
