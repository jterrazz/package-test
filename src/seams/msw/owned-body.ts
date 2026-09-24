/**
 * A reply's body, handed to the caller as a stream this package owns.
 *
 * msw keeps a second branch of every reply's body for its own `response`
 * event and never cancels it, and a branch of a tee settles its `cancel()`
 * only once BOTH branches are cancelled — so the branch the caller was
 * handed could never settle a cancel. The owned stream reads the caller's
 * branch as it is pulled, and settles its own cancel at once: the branch
 * underneath is told to cancel and is not waited on.
 */

/** Tell the branch underneath to cancel, waited on by nobody: it settles, or never does, on msw's side. */
async function release(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    reason: unknown,
): Promise<void> {
    try {
        await reader.cancel(reason);
    } catch {
        // How msw's branch ends is not the subject's to hear.
    }
}

/** The same reply — status, headers, address — its body the owned stream. */
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

/** `fetch`, every reply it resolves to handed back with its body owned. */
export function owningBodies(engine: typeof fetch): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
        withOwnedBody(await engine(input, init));
}
