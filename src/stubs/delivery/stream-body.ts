import { pause } from '../../chain/pause.js';
import type { StreamBody } from '../exchange.js';

/** One serialisation for all three deliveries (msw server, msw worker, `node:http` stub). */

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
            // invariant: the spacing is between chunks: the first is not held back.
            // Stryker disable next-line ConditionalExpression,EqualityOperator: a pause of nothing holds back no chunk a reader could tell
            if (body.delayBetweenChunks > 0 && index > 0) {
                await pause(body.delayBetweenChunks);
            }
            index += 1;
            controller.enqueue(encoder.encode(chunk));
        },
    });
}
