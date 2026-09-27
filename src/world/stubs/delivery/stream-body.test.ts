import { describe, expect, test } from 'vitest';

import { clock } from '../../clock/clock.js';
import { STREAM_BODY } from '../exchange.js';
import { toReadableStream } from './stream-body.js';

function streamOf(chunks: string[], delay: number): ReadableStreamDefaultReader<Uint8Array> {
    return toReadableStream({
        chunks,
        contentType: 'text/plain',
        delayBetweenChunks: delay,
        kind: STREAM_BODY,
    }).getReader();
}

function textOf(read: ReadableStreamReadResult<Uint8Array> | undefined): string | undefined {
    if (read === undefined) {
        return undefined;
    }
    return read.done ? 'done' : new TextDecoder().decode(read.value);
}

describe('toReadableStream', () => {
    test('the first piece arrives at once, each next one only after the declared spacing, then the stream closes', async () => {
        // Given - the scheduler pinned, and a stream of two pieces 50ms apart
        using _ = clock.run();
        const reader = streamOf(['a', 'b'], 50);

        // When - the subject reads the first piece, then asks for the next
        const first = textOf(await reader.read());
        let second: ReadableStreamReadResult<Uint8Array> | undefined;
        const pending = (async (): Promise<void> => {
            second = await reader.read();
        })();
        await clock.advance(49);
        const early = textOf(second);
        await clock.advance(1);
        await pending;

        // Then - the first piece was not held back, the second came due at 50ms, and the stream closes after it
        expect([first, early, textOf(second), textOf(await reader.read())]).toStrictEqual([
            'a',
            undefined,
            'b',
            'done',
        ]);
    });
});
