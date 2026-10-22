import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { afterEach, describe, expect, onTestFinished, test } from 'vitest';

import type { Lesson } from '../port-in-use.js';
import { claimPort, DRAWN_PORTS, DRAWS, reservePort } from '../port-reservation.js';
import type { Reservation } from '../port-reservation.js';
import { held } from './serve.fixtures.js';

const reservations: Reservation[] = [];

afterEach(() => {
    for (const reservation of reservations.splice(0)) {
        reservation.release();
    }
});

function kept<T extends Lesson | Reservation | undefined>(reserved: T): T {
    const value: Lesson | Reservation | undefined = reserved;
    if (value !== undefined && 'release' in value) {
        reservations.push(value);
    }
    return reserved;
}

function portOf(reserved: Awaited<ReturnType<typeof reservePort>>): number | string {
    return 'release' in reserved ? reserved.port : reserved.found;
}

async function quietPort(): Promise<number> {
    const reserved = await reservePort(undefined);
    if (!('release' in reserved)) {
        throw new Error(reserved.found);
    }
    reserved.release();
    return reserved.port;
}

async function claimedElsewhere(port: number): Promise<void> {
    const sibling = spawn(
        process.execPath,
        [
            '-e',
            `require('node:dgram').createSocket('udp4').bind({ address: '127.0.0.1', exclusive: true, port: ${String(port)} }, () => console.log('claimed'))`,
        ],
        { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    onTestFinished(() => {
        sibling.kill('SIGKILL');
    });
    await once(sibling.stdout, 'data');
}

function neverDrawn(): number {
    throw new Error('a pinned port is never drawn');
}

describe('port-reservation', () => {
    test('claimPort — a port claimed — is refused to a second claim, from this process or another, until it is released', async () => {
        // Given - one port claimed here, another claimed by a sibling process
        const here = await quietPort();
        const elsewhere = await quietPort();
        const first = kept(await claimPort(here));
        await claimedElsewhere(elsewhere);

        // When - each is claimed again, and the first is claimed once more after its release
        const second = kept(await claimPort(here));
        const third = kept(await claimPort(elsewhere));
        first?.release();
        first?.release();
        const afterRelease = kept(await claimPort(here));

        // Then - the held ones are refused, and a released one is claimable again
        expect([first?.port, second, third, afterRelease?.port]).toStrictEqual([
            here,
            undefined,
            undefined,
            here,
        ]);
    });

    test('claimPort — a claim — never stops the server binding its TCP port of that number', async () => {
        // Given - a claimed port
        const reservation = kept(await claimPort(await quietPort()));

        // When - a server listens on it over TCP
        const server = createServer();
        const bound = await new Promise<number>((resolve, reject) => {
            server.once('error', reject);
            server.listen(reservation?.port, '127.0.0.1', () => {
                const address = server.address();
                resolve(typeof address === 'object' && address !== null ? address.port : 0);
            });
        });
        server.close();

        // Then - it bound the very port claimed
        expect(bound).toBe(reservation?.port);
    });

    test('reservePort — draws — fall below the range every OS hands unasked ports from, each one claimed until released', async () => {
        // Given - many reservations held at once
        const drawn = await Promise.all(
            Array.from({ length: 48 }, async () => kept(await reservePort(undefined))),
        );
        const ports = drawn.map((reserved) => Number(portOf(reserved)));

        // Then - every port is distinct, in the drawn range, and refused to another claim while held
        const reclaimed = await Promise.all(ports.map(async (port) => kept(await claimPort(port))));
        expect({
            distinct: new Set(ports).size,
            inRange: ports.every((port) => port >= DRAWN_PORTS.first && port <= DRAWN_PORTS.last),
            reclaimed: reclaimed.filter((reservation) => reservation !== undefined).length,
            range: DRAWN_PORTS,
        }).toStrictEqual({
            distinct: 48,
            inRange: true,
            reclaimed: 0,
            range: { first: 10_000, last: 32_767 },
        });
    });

    test.each(['127.0.0.1', '::1'])(
        'reservePort — a decoy server listening on a drawn port on %s, and a port a sibling process claimed — are passed over for the next draw',
        async (host) => {
            // Given - a decoy listening over TCP, a port another process claimed, and a quiet port
            const decoy = await held(host);
            onTestFinished(() => {
                decoy.server.close();
            });
            const sibling = await quietPort();
            await claimedElsewhere(sibling);
            const quiet = await quietPort();
            const draws = [decoy.port, sibling, quiet];

            // When - those are drawn in turn
            const reserved = kept(await reservePort(undefined, () => draws.shift() ?? 0));

            // Then - the quiet one is reserved, and the decoy's port is left claimable, its claim released
            expect([portOf(reserved), draws.length]).toStrictEqual([quiet, 0]);
            const decoyPort = kept(await claimPort(decoy.port));
            expect(decoyPort?.port).toBe(decoy.port);
        },
    );

    test('reservePort — every draw held — answers why no port was reserved, after its last draw', async () => {
        // Given - a port a sibling process claimed, drawn every time
        const sibling = await quietPort();
        await claimedElsewhere(sibling);
        let draws = 0;

        // When - nothing else is ever drawn
        const reserved = await reservePort(undefined, () => {
            draws += 1;
            return sibling;
        });

        // Then - the lesson, after every draw it is allowed
        expect([reserved, draws, DRAWS]).toStrictEqual([
            {
                fix: 'stop the servers holding the ports of that range, or pin a free one with `port`',
                found: 'no free port in 10000-32767 after 64 draws',
                why: 'A process is handed a port drawn below the range the OS hands unasked ports from, and one nothing holds.',
            },
            64,
            64,
        ]);
    });

    test('reservePort — a pinned port — is claimed as it stands, never drawn, and refused while another holds it', async () => {
        // Given - a pinned port, and a draw that must not be asked
        const port = await quietPort();

        // When - it is reserved twice
        const first = kept(await reservePort(port, neverDrawn));
        const second = kept(await reservePort(port, neverDrawn));

        // Then - the first holds it, the second is the pinned lesson
        expect([portOf(first), portOf(second)]).toStrictEqual([
            port,
            `port ${String(port)}, which \`port\` pins, is reserved by another served process on this machine`,
        ]);
    });
});
