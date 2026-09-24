import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { RunningApp, StaleElementError, nameOf } from './app.js';
import type { Mounted, ScriptedApp } from './app.js';
import { InvalidSelectorError, compilePredicate } from './predicate.js';

/**
 * The Appium protocol double — a WebDriver server that answers like Appium's
 * XCUITest driver, from a {@link ScriptedApp} instead of a simulator.
 *
 * It speaks the W3C endpoints the mobile facet's adapter calls: a session
 * created for the app's bundle id on a named device, the `mobile:` scripts
 * that terminate, activate, deep-link and scroll, element search by
 * `-ios predicate string`, click, clear and value, attributes, the page
 * source and a screenshot. Every other endpoint answers `unknown command`, the
 * way a driver refuses one it does not implement — so a new call the adapter
 * starts making fails here before it fails on a device.
 */

/** The key a W3C element reference is carried under. */
const ELEMENT_KEY = 'element-6066-11e4-a23f-4f71c9fb7e65';

/** A 1×1 transparent PNG — the screenshot the double takes of any screen. */
const PIXEL =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/** A protocol error: its W3C code, the HTTP status it is sent with, and a message. */
class ProtocolError extends Error {
    constructor(
        readonly code: string,
        readonly status: number,
        message: string,
    ) {
        super(message);
    }
}

type Json = Record<string, unknown>;

/** A running double: the URL to hand `appium: { url }`, and its stop. */
export type AppiumDouble = { stop: () => Promise<void>; url: string };

async function bodyOf(request: IncomingMessage): Promise<Json> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
        chunks.push(chunk as Buffer);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    return text === '' ? {} : (JSON.parse(text) as Json);
}

function send(response: ServerResponse, status: number, value: unknown): void {
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ value }));
}

/** The capabilities a new-session request asks for, `alwaysMatch` over the first `firstMatch`. */
function requested(body: Json): Json {
    const capabilities = (body.capabilities ?? {}) as { alwaysMatch?: Json; firstMatch?: Json[] };
    return { ...capabilities.firstMatch?.[0], ...capabilities.alwaysMatch };
}

/** The attributes a predicate reads, as XCUITest exposes them. */
function predicateAttributes(node: Mounted): Record<string, string | undefined> {
    return {
        label: node.label ?? '',
        name: nameOf(node) ?? '',
        type: `XCUIElementType${node.type}`,
        value: node.value ?? '',
        visible: node.visible ? '1' : '0',
    };
}

/** An attribute as `getAttribute` answers it. */
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

/** One session: the app it drives, and what the protocol routes onto it. */
class Session {
    readonly app: RunningApp;

    constructor(private readonly scripted: ScriptedApp) {
        this.app = new RunningApp(scripted);
    }

    async execute(body: Json): Promise<unknown> {
        const script = String(body.script);
        const [argument] = (body.args ?? []) as Json[];
        switch (script) {
            case 'mobile: terminateApp': {
                this.app.terminate();
                return true;
            }
            case 'mobile: activateApp': {
                this.bundle(argument);
                await this.app.launch();
                return null;
            }
            case 'mobile: deepLink': {
                this.bundle(argument);
                this.app.terminate();
                await this.app.deepLink(String(argument?.url));
                return null;
            }
            case 'mobile: scroll': {
                this.app.scrollTo(this.app.element(String(argument?.elementId)));
                return null;
            }
            default: {
                throw new ProtocolError('unknown command', 404, `unsupported script: ${script}`);
            }
        }
    }

    find(body: Json, scope?: Mounted): Json[] {
        if (body.using !== '-ios predicate string') {
            throw new ProtocolError(
                'invalid selector',
                400,
                `locator strategy '${String(body.using)}' is not one the double answers`,
            );
        }
        let predicate;
        try {
            predicate = compilePredicate(String(body.value));
        } catch (error) {
            if (error instanceof InvalidSelectorError) {
                throw new ProtocolError('invalid selector', 400, error.message);
            }
            throw error;
        }
        return this.app
            .descendants(scope)
            .filter((node) => predicate(predicateAttributes(node)))
            .map((node) => ({ ELEMENT: node.id, [ELEMENT_KEY]: node.id }));
    }

    private bundle(argument: Json | undefined): void {
        if (argument?.bundleId !== this.scripted.bundleId) {
            throw new ProtocolError(
                'unknown error',
                500,
                `app with bundle identifier '${String(argument?.bundleId)}' is not installed`,
            );
        }
    }
}

/** Route one request onto the sessions; the value to send, or a protocol error. */
async function route(
    app: ScriptedApp,
    sessions: Map<string, Session>,
    method: string,
    path: string[],
    body: Json,
): Promise<unknown> {
    if (method === 'GET' && path[0] === 'status') {
        return { message: 'The Appium protocol double is ready', ready: true };
    }
    if (method === 'POST' && path.length === 1 && path[0] === 'session') {
        return await createSession(app, sessions, body);
    }
    const [head, sessionId, ...rest] = path;
    const session = head === 'session' ? sessions.get(sessionId ?? '') : undefined;
    if (session === undefined) {
        throw new ProtocolError('invalid session id', 404, `no session ${sessionId ?? ''}`);
    }
    const command = `${method} ${rest.map((part, index) => (index === 1 && rest[0] === 'element' ? ':id' : part)).join('/')}`;
    const element = rest[0] === 'element' && rest[1] !== undefined ? rest[1] : undefined;
    switch (command) {
        case 'DELETE ': {
            sessions.delete(sessionId ?? '');
            return null;
        }
        case 'POST execute/sync': {
            return await session.execute(body);
        }
        case 'POST elements': {
            return session.find(body);
        }
        case 'POST element/:id/elements': {
            return session.find(body, session.app.element(element ?? ''));
        }
        case 'POST element/:id/click': {
            await session.app.tap(session.app.element(element ?? ''));
            return null;
        }
        case 'POST element/:id/clear': {
            session.app.clear(session.app.element(element ?? ''));
            return null;
        }
        case 'POST element/:id/value': {
            session.app.type(session.app.element(element ?? ''), String(body.text ?? ''));
            return null;
        }
        case 'GET source': {
            return session.app.source();
        }
        case 'GET screenshot': {
            return PIXEL;
        }
        default: {
            if (command.startsWith('GET element/:id/attribute/')) {
                return attributeOf(session.app.element(element ?? ''), rest[3] ?? '');
            }
            throw new ProtocolError('unknown command', 404, `the double does not answer ${method} /${path.join('/')}`);
        }
    }
}

/** A new session: the capabilities an XCUITest session needs, or `session not created`. */
async function createSession(
    app: ScriptedApp,
    sessions: Map<string, Session>,
    body: Json,
): Promise<Json> {
    const capabilities = requested(body);
    const refuse = (why: string): ProtocolError =>
        new ProtocolError('session not created', 500, `A new session could not be created. ${why}`);
    if (String(capabilities.platformName).toLowerCase() !== 'ios') {
        throw refuse(`platformName must be iOS, got '${String(capabilities.platformName)}'`);
    }
    if (capabilities['appium:automationName'] !== 'XCUITest') {
        throw refuse('appium:automationName must be XCUITest');
    }
    if (capabilities['appium:bundleId'] !== app.bundleId) {
        throw refuse(`app with bundle identifier '${String(capabilities['appium:bundleId'])}' is not installed`);
    }
    if (capabilities['appium:deviceName'] === undefined && capabilities['appium:udid'] === undefined) {
        throw refuse('no device named: pass appium:deviceName or appium:udid');
    }
    const session = new Session(app);
    await session.app.launch();
    const sessionId = randomUUID();
    sessions.set(sessionId, session);
    return { capabilities, sessionId };
}

/** Start the double for one scripted app, on a free loopback port. */
export async function startAppiumDouble(app: ScriptedApp): Promise<AppiumDouble> {
    const sessions = new Map<string, Session>();
    const server = createServer((request, response) => {
        void (async () => {
            try {
                const url = new URL(request.url ?? '/', 'http://double');
                const path = url.pathname.split('/').filter((part) => part !== '');
                const body = request.method === 'POST' ? await bodyOf(request) : {};
                send(response, 200, await route(app, sessions, request.method ?? 'GET', path, body));
            } catch (error) {
                const failure =
                    error instanceof ProtocolError
                        ? error
                        : error instanceof StaleElementError
                          ? new ProtocolError('stale element reference', 404, error.message)
                          : new ProtocolError('unknown error', 500, String(error));
                send(response, failure.status, { error: failure.code, message: failure.message, stacktrace: '' });
            }
        })();
    });
    await new Promise<void>((resolveListen) => {
        server.listen(0, '127.0.0.1', resolveListen);
    });
    const { port } = server.address() as AddressInfo;
    return {
        stop: async () => {
            await new Promise<void>((resolveClose) => {
                server.closeAllConnections();
                server.close(() => {
                    resolveClose();
                });
            });
        },
        url: `http://127.0.0.1:${port}`,
    };
}
