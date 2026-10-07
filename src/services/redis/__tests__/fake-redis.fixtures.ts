import { createServer } from 'node:net';
import type { AddressInfo, Socket } from 'node:net';

/** A RESP server on port 0: every command but the handshake logged as its words, `close` when a client hangs up. */
export type FakeRedis = {
    /** Resolves once every connection opened so far has closed. */
    closed: () => Promise<void>;
    log: string[];
    stop: () => Promise<void>;
    url: string;
};

const HANDSHAKE = new Set(['CLIENT', 'HELLO']);

// invariant: the commands of one chunk, each its words: `*<n>` then `$<length>` and the word, n times.
function commandsIn(chunk: string): string[][] {
    const lines = chunk.split('\r\n');
    const commands: string[][] = [];
    let at = 0;
    while (lines[at]?.startsWith('*') === true) {
        const count = Number(lines[at]?.slice(1));
        commands.push(lines.slice(at + 1, at + 1 + 2 * count).filter((_, line) => line % 2 === 1));
        at += 1 + 2 * count;
    }
    return commands;
}

function answer(words: string[], refusing: string[]): string {
    const [name = ''] = words;
    if (refusing.includes(name)) {
        return `-ERR ${name} refused\r\n`;
    }
    return name === 'PING' ? '+PONG\r\n' : '+OK\r\n';
}

export async function fakeRedis(refusing: string[] = []): Promise<FakeRedis> {
    const log: string[] = [];
    const ends: Promise<void>[] = [];
    const serve = (socket: Socket): void => {
        ends.push(
            new Promise((resolve) => {
                socket.on('close', () => {
                    log.push('close');
                    resolve();
                });
            }),
        );
        socket.on('data', (chunk) => {
            for (const words of commandsIn(String(chunk))) {
                if (!HANDSHAKE.has(words[0] ?? '')) {
                    log.push(words.join(' '));
                }
                socket.write(answer(words, refusing));
            }
        });
    };
    const server = createServer(serve);
    await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
    });
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a TCP server listening on a host answers an AddressInfo
    const { port } = server.address() as AddressInfo;
    return {
        closed: async () => {
            await Promise.all(ends);
        },
        log,
        stop: async () => {
            await new Promise((resolve) => {
                server.close(resolve);
            });
        },
        url: `redis://127.0.0.1:${port}`,
    };
}
