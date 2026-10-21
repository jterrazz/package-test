import { once } from 'node:events';
import { connect, createServer } from 'node:net';

import { listenedPort } from '../../chain/listened-port.js';

export async function findFreePort(): Promise<number> {
    const server = createServer();
    const port = await listenedPort(server);
    server.close();
    await once(server, 'close');
    return port;
}

// Stryker disable BlockStatement: a catch emptied answers undefined, which reads as no answer all the same
export async function firstAnswering(urls: readonly string[]): Promise<string | undefined> {
    const answered = await Promise.all(
        urls.map(async (url) => ((await answers(url)) ? url : undefined)),
    );

    return answered.find((url) => url !== undefined);
}

async function answers(url: string): Promise<boolean> {
    try {
        await fetch(url, { redirect: 'manual' });
        return true;
    } catch {
        return false;
    }
}
// Stryker restore BlockStatement

// invariant: the loopback hosts the readiness probe asks, so a port held on either is one the probe would read as the server's.
const LOOPBACK = ['127.0.0.1', '::1'];

export async function holdingHost(port: number): Promise<string | undefined> {
    const accepted = await Promise.all(
        LOOPBACK.map(async (host) => ((await accepts(host, port)) ? host : undefined)),
    );

    return accepted.find((host) => host !== undefined);
}

async function accepts(host: string, port: number): Promise<boolean> {
    return await new Promise((resolve) => {
        const socket = connect({ host, port });
        socket.once('connect', () => {
            // Stryker disable next-line CallExpression: a socket left open closes with this process, and the answer is read already
            socket.destroy();
            resolve(true);
        });
        socket.once('error', () => {
            resolve(false);
        });
    });
}
