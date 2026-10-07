import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { ServerResponse } from 'node:http';
import { text } from 'node:stream/consumers';

import { nameOf } from './app.js';
import type { Mounted, ScriptedApp } from './app.js';
import { ProtocolError } from './protocol-error.js';
import { isJson, Session } from './session.js';
import type { Json } from './session.js';
import { StaleElementError } from './stale-element-error.js';

/**
 * outside: the Appium protocol double — a WebDriver server that answers like Appium's
 * XCUITest driver, from a {@link ScriptedApp} instead of a simulator.
 *
 * It speaks the W3C endpoints the mobile specification's adapter calls: a session
 * created for the app's bundle id on a named device, the `mobile:` scripts
 * that terminate, activate, deep-link and scroll to an element, element
 * search by `-ios predicate string`, click, clear and value, attributes, the
 * page source, a screenshot and the session's timeouts. Every other endpoint answers `unknown command`, the
 * way a driver refuses one it does not implement — so a new call the adapter
 * starts making fails here before it fails on a device.
 */

const PIXEL =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/** `windows` counts the sessions that asked for no headless simulator: the XCUITest driver opens the simulator's window for each. */
export type SessionCount = { created: number; deleted: number; windows: number };

export type AppiumDouble = { sessions: SessionCount; stop: () => Promise<void>; url: string };

type Served = { app: ScriptedApp; count: SessionCount; sessions: Map<string, Session> };

type Call = { body: Json; element: () => Mounted; rest: string[]; session: Session };

async function bodyOf(request: AsyncIterable<unknown>): Promise<Json> {
    const read = await text(request);
    const parsed: unknown = read === '' ? {} : JSON.parse(read);
    return isJson(parsed) ? parsed : {};
}

function send(response: ServerResponse, status: number, value: unknown): void {
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ value }));
}

function requested(body: Json): Json {
    const capabilities = isJson(body.capabilities) ? body.capabilities : {};
    const { firstMatch } = capabilities;
    const first: unknown = Array.isArray(firstMatch) ? firstMatch[0] : undefined;
    return {
        ...(isJson(first) ? first : {}),
        ...(isJson(capabilities.alwaysMatch) ? capabilities.alwaysMatch : {}),
    };
}

function attributeOf(node: Mounted, name: string): null | string {
    switch (name) {
        case 'label': {
            return node.label ?? null;
        }
        case 'name': {
            return nameOf(node) ?? null;
        }
        case 'type': {
            return `XCUIElementType${node.type}`;
        }
        case 'value': {
            return node.value ?? null;
        }
        case 'visible': {
            return String(node.visible);
        }
        case 'enabled': {
            return 'true';
        }
        default: {
            return null;
        }
    }
}

const COMMANDS: Readonly<Record<string, (call: Call) => unknown>> = {
    'GET element/:id/attribute': ({ element, rest }) => attributeOf(element(), rest[3] ?? ''),
    'GET screenshot': () => PIXEL,
    'GET source': ({ session }) => session.app.source(),
    'GET timeouts': () => ({ implicit: 0, pageLoad: 300_000, script: 30_000 }),
    'POST element/:id/clear': ({ element, session }) => {
        session.app.clear(element());
        return null;
    },
    'POST element/:id/click': async ({ element, session }) => {
        await session.app.tap(element());
        return null;
    },
    'POST element/:id/elements': ({ body, element, session }) =>
        session.elementsMatching(body, element()),
    'POST element/:id/value': ({ body, element, session }) => {
        session.app.type(element(), typeof body.text === 'string' ? body.text : '');
        return null;
    },
    'POST elements': ({ body, session }) => session.elementsMatching(body),
    'POST execute/sync': async ({ body, session }) => await session.execute(body),
};

function commandOf(method: string, rest: string[]): string {
    const [head, id, attribute] = rest;
    if (head !== 'element' || id === undefined) {
        return `${method} ${rest.join('/')}`;
    }
    return attribute === 'attribute'
        ? `${method} element/:id/attribute`
        : `${method} ${['element', ':id', ...rest.slice(2)].join('/')}`;
}

function refused(why: string): ProtocolError {
    return new ProtocolError(
        'session not created',
        500,
        `A new session could not be created. ${why}`,
    );
}

async function createSession({ app, count, sessions }: Served, body: Json): Promise<Json> {
    const capabilities = requested(body);
    if (String(capabilities.platformName).toLowerCase() !== 'ios') {
        throw refused(`platformName must be iOS, got '${String(capabilities.platformName)}'`);
    }
    if (capabilities['appium:automationName'] !== 'XCUITest') {
        throw refused('appium:automationName must be XCUITest');
    }
    if (capabilities['appium:bundleId'] !== app.bundleId) {
        throw refused(
            `app with bundle identifier '${String(capabilities['appium:bundleId'])}' is not installed`,
        );
    }
    if (
        capabilities['appium:deviceName'] === undefined &&
        capabilities['appium:udid'] === undefined
    ) {
        throw refused('no device named: pass appium:deviceName or appium:udid');
    }
    const session = new Session(app);
    await session.app.launch();
    const sessionId = randomUUID();
    sessions.set(sessionId, session);
    count.created += 1;
    count.windows += capabilities['appium:isHeadless'] === true ? 0 : 1;
    return { capabilities, sessionId };
}

async function route(
    { app, count, sessions }: Served,
    method: string,
    path: string[],
    body: Json,
): Promise<unknown> {
    if (method === 'GET' && path[0] === 'status') {
        return { message: 'The Appium protocol double is ready', ready: true };
    }
    if (method === 'POST' && path.length === 1 && path[0] === 'session') {
        return await createSession({ app, count, sessions }, body);
    }
    const [head, sessionId = '', ...rest] = path;
    const session = head === 'session' ? sessions.get(sessionId) : undefined;
    if (session === undefined) {
        throw new ProtocolError('invalid session id', 404, `no session ${sessionId}`);
    }
    if (method === 'DELETE' && rest.length === 0) {
        sessions.delete(sessionId);
        count.deleted += 1;
        return null;
    }
    const command = COMMANDS[commandOf(method, rest)];
    if (command === undefined) {
        throw new ProtocolError(
            'unknown command',
            404,
            `the double does not answer ${method} /${path.join('/')}`,
        );
    }
    return await command({
        body,
        element: () => session.app.element(rest[1] ?? ''),
        rest,
        session,
    });
}

function failureOf(error: unknown): ProtocolError {
    if (error instanceof ProtocolError) {
        return error;
    }
    return error instanceof StaleElementError
        ? new ProtocolError('stale element reference', 404, error.message)
        : new ProtocolError('unknown error', 500, String(error));
}

export async function startAppiumDouble(app: ScriptedApp): Promise<AppiumDouble> {
    const served: Served = {
        app,
        count: { created: 0, deleted: 0, windows: 0 },
        sessions: new Map(),
    };
    const server = createServer((request, response) => {
        void (async () => {
            try {
                const url = new URL(request.url ?? '/', 'http://double');
                const path = url.pathname.split('/').filter((part) => part !== '');
                const body = request.method === 'POST' ? await bodyOf(request) : {};
                send(response, 200, await route(served, request.method ?? 'GET', path, body));
            } catch (error) {
                const failure = failureOf(error);
                send(response, failure.status, {
                    error: failure.code,
                    message: failure.message,
                    stacktrace: '',
                });
            }
        })();
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    return {
        sessions: served.count,
        stop: async () => {
            server.closeAllConnections();
            server.close();
            await once(server, 'close');
        },
        url: `http://127.0.0.1:${port}`,
    };
}
