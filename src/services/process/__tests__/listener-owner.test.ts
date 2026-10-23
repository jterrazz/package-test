import { afterEach, describe, expect, onTestFinished, test } from 'vitest';

import {
    childOwnsPort,
    groupOwnsPort,
    listeningInodes,
    owns,
    ownsFromLsof,
    processGroupOf,
    socketInode,
} from '../listener-owner.js';
import { ServedProcess } from '../serve.js';
import { HANDS_PORT_AWAY, refused } from './serve.fixtures.js';

const TCP_TABLE = [
    '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode',
    '   0: 0100007F:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 111 1 0000000000000000 100 0 0 10 0',
    '   1: 0100007F:1F90 0100007F:D431 01 00000000:00000000 00:00000000 00000000  1000        0 222 1 0000000000000000 20 4 30 10 -1',
    '   2: 00000000:1F91 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 333 1 0000000000000000 100 0 0 10 0',
    '',
].join('\n');

let adapter: null | ServedProcess = null;

afterEach(async () => {
    await adapter?.stop();
    adapter = null;
});

describe('listener-owner', () => {
    test('childOwnsPort — a served process whose port answers from outside its group — is refused, never read as ready', async () => {
        // Given - a command that hands its port to a server it detaches into a group of its own
        adapter = new ServedProcess(
            { command: HANDS_PORT_AWAY, timeout: 10_000 },
            process.cwd(),
            'api',
        );

        // When - it starts
        const failure = await adapter.start().then(() => '', String);
        const { pid = '', port = '' } =
            /away (?<pid>\d+) (?<port>\d+)/u.exec(failure)?.groups ?? {};
        onTestFinished(() => {
            process.kill(Number(pid), 'SIGKILL');
        });

        // Then - refused for the answer that was not its own
        expect(failure).toContain(
            refused(
                `port ${port} answered, and a process the command did not start listens on it.\nCommand: ${HANDS_PORT_AWAY}\nOutput:\naway ${pid} ${port}\n`,
                'A process is ready once its own server answers, and an answer from another process on its port is not one.',
                'stop the process holding that port, or announce the port with a `ready` pattern if the server runs outside the command (a container, a daemon)',
            ),
        );
    });

    test("owns — a port is the group's when one listener is and none it sees is not", () => {
        // Given - the group's sockets
        const owned = new Set(['1', '2']);

        // Then - owned with its listeners alone, not with a stranger beside them nor with no listener
        expect([owns(['1', '2'], owned), owns(['1', '3'], owned), owns([], owned)]).toStrictEqual([
            true,
            false,
            false,
        ]);
    });

    test('ownsFromLsof — the groups lsof prints for the listeners — are read off the g lines', () => {
        // Given - the group 40
        const group = 40;

        // Then - one process of the group, a stranger beside it, and nothing listed
        expect([
            ownsFromLsof('p41\ng40\nf12\n', group),
            ownsFromLsof('p41\ng40\nf12\np90\ng90\nf3\n', group),
            ownsFromLsof('', group),
        ]).toStrictEqual([true, false, false]);
    });

    test('listeningInodes — the rows of /proc/net/tcp — names the inodes listening on the port alone', () => {
        // Given - a table with a listener and a connection on 8080, and a listener on 8081
        const table = TCP_TABLE;

        // Then - the listening row of 8080, never its connected one nor another port's
        expect([
            listeningInodes(table, 8080),
            listeningInodes(table, 8081),
            listeningInodes('', 8080),
        ]).toStrictEqual([['111'], ['333'], []]);
    });

    test('processGroupOf — a /proc stat line — reads the group past a command name holding spaces and parentheses', () => {
        // Given - a plain command name, and one holding spaces and parentheses
        const stats = ['12 (node) S 1 12 12 0', '13 (a (b) c) S 12 7 7 0'];

        // Then - the fifth field, counted after the command name
        expect(stats.map((stat) => processGroupOf(stat))).toStrictEqual([12, 7]);
    });

    test("socketInode — a file descriptor link — names a socket's inode and nothing for another file", () => {
        // Given - a socket, a file and a pipe
        const links = ['socket:[4242]', '/dev/null', 'pipe:[17]'];

        // Then - a socket's inode, nothing for a file or a pipe
        expect(links.map((link) => socketInode(link))).toStrictEqual([
            '4242',
            undefined,
            undefined,
        ]);
    });

    test('groupOwnsPort — a platform it cannot read — cannot tell, and a child never spawned owns nothing it can tell', async () => {
        // Given - a platform with no lsof and no /proc
        const platform = 'win32';

        // Then - no verdict either way
        expect([await groupOwnsPort(1, 1, platform), await childOwnsPort(1, null)]).toStrictEqual([
            undefined,
            undefined,
        ]);
    });
});
