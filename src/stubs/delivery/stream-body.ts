import { pause } from '../../chain/pause.js';
import type { StreamBody } from '../exchange.js';

// outside: msw's server writes a reply to a socket undici reads back, so chunks enqueued in one task land as one read; a message is a task no fake clock holds.
async function nextTask(): Promise<void> {
    const { port1, port2 } = new MessageChannel();
    await new Promise<void>((resolve) => {
        // oxlint-disable-next-line unicorn/prefer-add-event-listener -- the setter starts the port in a page and in node alike; a listener added leaves a page's port to a start() node never needs
        port1.onmessage = () => {
            // Stryker disable next-line CallExpression: a port left open only holds the event loop of a worker vitest ends itself, and the task is taken already
            port1.close();
            resolve();
        };
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
