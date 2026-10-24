import type { SetupServer } from 'msw/node';
import { METHODS } from 'node:http';

import { refusal } from '../../../chain/refusals/refusal.js';
import type { StubRegistration } from '../../intercept/intercept.js';
import type { Stub } from '../../stub.js';
import { buildStubHandlers } from '../msw-handlers.js';
import type { Msw } from '../msw-handlers.js';

async function loadMsw(): Promise<{ msw: Msw; setupServer: () => SetupServer }> {
    const [{ setupServer }, msw] = await Promise.all([import('msw/node'), import('msw')]);
    return { msw, setupServer: () => setupServer() };
}

let serverInstance: null | SetupServer = null;
let registrations = 0;
let refuseOffTheWire: ((request: Request) => Response) | null = null;

function offTheWireError(request: Request): Error {
    return new Error(
        refusal('network-strict-after-first-stub', {
            fix: 'send a method in the capitals the HTTP parser reads (`PATCH`, not `patch`): fetch upper-cases DELETE, GET, HEAD, OPTIONS, POST and PUT, and sends any other as written',
            found: `an outgoing request the network double cannot read off the wire, ${request.method} ${request.url}: its method is not one of node's \`http.METHODS\`, so no stub could answer it and it would reach the network`,
        }),
    );
}

// outside: msw reads a request off the socket with an HTTP parser, which takes no method outside `http.METHODS` and lets it through to the network unseen. Closing the server puts back the `fetch` msw found, which drops this wrapper with msw's own.
function guardOffTheWireMethods(): void {
    const next = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
        const request = new Request(input, init);
        if (refuseOffTheWire !== null && !METHODS.includes(request.method)) {
            return refuseOffTheWire(request);
        }
        return await next(request);
    };
}

// invariant: listening only while a registration holds it: msw takes over every socket the process dials, so a request no chain stubs (a deployed api's, over TLS) reaches the network untouched once the last stubs are released.
async function ensureStubServer(): Promise<SetupServer> {
    if (serverInstance !== null) {
        return serverInstance;
    }
    const { setupServer } = await loadMsw();
    const server = setupServer();
    server.listen({ onUnhandledFrame: 'bypass' });
    guardOffTheWireMethods();
    serverInstance = server;
    return server;
}

/** The trailing catch-all records any request no stub accepted; the chain's pipeline rethrows it. */
export async function registerStubs(stubs: readonly Stub[]): Promise<StubRegistration> {
    const server = await ensureStubServer();
    const { msw } = await loadMsw();
    const { handlers, refuse, violation } = buildStubHandlers(msw, stubs);
    server.use(...handlers);
    refuseOffTheWire = (request) =>
        refuse(offTheWireError(request), `unreadable request ${request.method} ${request.url}`);

    registrations += 1;
    let released = false;

    return {
        cleanup: () => {
            if (released) {
                return;
            }
            released = true;
            refuseOffTheWire = null;
            server.resetHandlers();
            registrations -= 1;
            if (registrations === 0) {
                closeServer();
            }
        },
        violation,
    };
}

function closeServer(): void {
    if (serverInstance !== null) {
        serverInstance.close();
        serverInstance = null;
    }
}

export async function stopStubServer(): Promise<void> {
    registrations = 0;
    closeServer();
    await Promise.resolve();
}
