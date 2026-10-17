import { describe, expect, test } from 'vitest';

import { lessonOf } from '../port-in-use.js';

const REASON = { fix: 'f', found: 'the server exited', why: 'w' };

describe('lessonOf', () => {
    test('lessonOf — a reason stands when the output names no port held, whatever else it says', () => {
        // Given - outputs that name no bind failure
        // Then - the reason as it came
        expect([
            lessonOf(REASON, '', undefined),
            lessonOf(REASON, 'listening on 4321', 4321),
        ]).toStrictEqual([REASON, REASON]);
    });

    test.each([
        ["Node's code", 'Error: listen EADDRINUSE: address already in use 127.0.0.1:4321'],
        ["a framework's sentence", 'error: Port 3000 is already in use'],
        ['the words alone', 'the address already in use'],
    ])(
        'lessonOf — a port held is named by %s, and the option to drop is `port`',
        (_how, output) => {
            // Given - a server pinned to a port, and one handed its port
            const pinned = lessonOf(REASON, output, 4321);
            const handed = lessonOf(REASON, output, undefined);

            // Then - the lesson names the port option where one was pinned, else the `PORT` the command is handed
            expect([pinned.found, pinned.fix, handed.fix]).toStrictEqual([
                'the server could not bind its port, which another process already holds',
                'stop the process holding port 4321, or drop the `port` option so a free one is picked',
                'have the command listen on the `PORT` it is handed, a free one, or stop the process holding the port it binds',
            ]);
        },
    );
});
