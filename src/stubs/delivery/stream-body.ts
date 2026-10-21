import { pause } from '../../chain/pause.js';
import type { StreamBody } from '../exchange.js';

// outside: msw's server writes a reply to a socket undici reads back, so chunks enqueued in one task land as one read; a message is a task no fake clock holds.
async function nextTask(): Promise<void> {
    const { port1, port2 } = new MessageChannel();
    await new Promise<void>((resolve) => {
        port1.addEventListener('message', () => {
            port1.close();
            resolve();
        });
        port1.start();
        port2.postMessage(null);
    });
}

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
            if (index > 0) {
                await pause(body.delayBetweenChunks);
                await nextTask();
            }
            index += 1;
            controller.enqueue(encoder.encode(chunk));
        },
    });
}
