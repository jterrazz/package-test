import { Socket } from 'node:net';
import { afterAll, describe, expect, test } from 'vitest';

import { http } from '../../../kinds/http.js';
import { defineStub } from '../../../stub.js';
import { registerStubs, stopStubServer } from '../stub-server.js';

afterAll(async () => {
    await stopStubServer();
});

const connectOf = (): unknown => Reflect.get(Socket.prototype, 'connect');

describe('stub-server', () => {
    test('registerStubs — releasing — msw holds the sockets of the process while two chains are armed, and lets them go with the last release', async () => {
        // Given - the socket connect the process starts with, and two chains armed one after the other
        await stopStubServer();
        const original = connectOf();
        const stub = defineStub({
            request: http.get('https://news.test/today'),
            response: http.text('stubbed'),
        });
        const first = await registerStubs([stub]);
        const second = await registerStubs([stub]);

        // When - the first releases, twice, then the second
        const armed = connectOf() === original;
        first.cleanup();
        first.cleanup();
        const held = connectOf() === original;
        second.cleanup();
        const released = connectOf() === original;
        await registerStubs([stub]);
        await stopStubServer();

        // Then - taken over while any chain is armed, and put back once none is, or once the server is stopped
        expect([armed, held, released, connectOf() === original]).toStrictEqual([
            false,
            false,
            true,
            true,
        ]);
    });
});
