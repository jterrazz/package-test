import { randomInt } from 'node:crypto';
import { createSocket } from 'node:dgram';
import type { Socket } from 'node:dgram';

import { holdingHost } from './listening.js';
import type { Lesson } from './port-in-use.js';

/** A port one served process holds until `release()`: no other served process on the machine is handed it meanwhile. */
export type Reservation = { port: number; release: () => void };

// outside: every OS hands an unasked port (a `listen(0)`, an outgoing connection's local end) from its ephemeral range, which starts at 32768 on Linux and at 49152 on macOS and Windows; a port drawn below it is never handed to another socket by chance.
export const DRAWN_PORTS = { first: 10_000, last: 32_767 } as const;
export const DRAWS = 64;

function draw(): number {
    // Stryker disable next-line ArithmeticOperator: the top of the range moved by two ports stays below every ephemeral range
    return randomInt(DRAWN_PORTS.first, DRAWN_PORTS.last + 1);
}

// invariant: the claim is a UDP socket on the TCP port's number: the two port spaces are apart, so the claim never stops the child binding its TCP port, and a second claim on the number is refused by the OS, from this process or any other, until the first is closed or its process dies.
export async function claimPort(port: number): Promise<Reservation | undefined> {
    const socket = createSocket('udp4');
    const failure = await new Promise<unknown>((resolve) => {
        // invariant: the listener stays once the claim is bound, the sink of an error the socket raises later, which would otherwise end the run.
        socket.on('error', resolve);
        // Stryker disable next-line StringLiteral: an empty address binds every interface, which claims the number all the same
        socket.bind({ address: '127.0.0.1', port }, () => {
            resolve(undefined);
        });
    });
    if (failure === undefined) {
        // Stryker disable next-line CallExpression: a claim left referenced holds the run open only until stop(), which every run reaches
        socket.unref();
        return { port, release: closing(socket) };
    }
    // Stryker disable next-line CallExpression: a socket that failed to bind holds no port, and closing it frees only its handle
    socket.close();
    // hazard: a port the OS refuses this process for another reason (a privileged one, under Linux) is held by no served process, and is left to the server's own bind to report.
    return failure instanceof Error && 'code' in failure && failure.code === 'EADDRINUSE'
        ? undefined
        : { port, release: () => undefined };
}

function closing(socket: Socket): () => void {
    let open = true;
    return () => {
        if (open) {
            open = false;
            socket.close();
        }
    };
}

async function reserveFreePort(pick: () => number = draw): Promise<Reservation | undefined> {
    for (let attempt = 0; attempt < DRAWS; attempt += 1) {
        const reservation = await claimPort(pick());
        if (reservation === undefined) {
            continue;
        }
        if ((await holdingHost(reservation.port)) === undefined) {
            return reservation;
        }
        reservation.release();
    }
    return undefined;
}

/** The port a served process is handed (the one `port` pins, else a drawn one) reserved for it, or the lesson of why none could be. */
export async function reservePort(
    pinned: number | undefined,
    pick: () => number = draw,
): Promise<Lesson | Reservation> {
    if (pinned !== undefined) {
        return (
            (await claimPort(pinned)) ?? {
                fix: 'drop the `port` option so each process is handed a free one, or run the specifications that pin it one at a time',
                found: `port ${String(pinned)}, which \`port\` pins, is reserved by another served process on this machine`,
                why: "A port is one served process's at a time, and a server sharing it would answer in the other's place.",
            }
        );
    }
    return (
        (await reserveFreePort(pick)) ?? {
            fix: 'stop the servers holding the ports of that range, or pin a free one with `port`',
            found: `no free port in ${String(DRAWN_PORTS.first)}-${String(DRAWN_PORTS.last)} after ${String(DRAWS)} draws`,
            why: 'A process is handed a port drawn below the range the OS hands unasked ports from, and one nothing holds.',
        }
    );
}
