import { pause } from '../timing/pause.js';
import type { StreamBody } from './types.js';

/**
 * A declared stream, made real — ONE serialisation for all three engines.
 *
 * msw's server and msw's worker take a `ReadableStream` body verbatim
 * (https://mswjs.io/docs/http/mocking-responses/streaming) and the `node:http`
 * stub pipes one into its response, so what "arriving in pieces" MEANS —
 * the order, the spacing, the close after the last chunk — is stated here and
 * nowhere else. A second copy of it would be a second answer to "what does the
 * subject read", and the facets would drift.
 */

/**
 * The pieces of `body`, in order, `delayBetweenChunks` milliseconds apart,
 * closing after the last one.
 */
export function toReadableStream(body: StreamBody): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let index = 0;
    return new ReadableStream<Uint8Array>({
        async pull(controller) {
            const chunk = body.chunks[index];
            if (chunk === undefined) {
                controller.close();
                return;
            }
            // The spacing is BETWEEN chunks: the first one is not held back,
            // Or every streamed reply would start late by one interval.
            if (body.delayBetweenChunks > 0 && index > 0) {
                await pause(body.delayBetweenChunks);
            }
            index += 1;
            controller.enqueue(encoder.encode(chunk));
        },
    });
}
