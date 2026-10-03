import type { attach, remote } from 'webdriverio';

import { refusal } from '../../../chain/refusals/refusal.js';
import type { MobileDevice } from '../device/device.port.js';
import { SERVER_CALL_TIMEOUT_MS } from './session-ledger.js';
import type { SessionLedger } from './session-ledger.js';

/** The session factory — webdriverio's `remote`, the adapter's single seam onto a new session. */
export type RemoteFn = typeof remote;

/** The way onto a session another runner opened — webdriverio's `attach`. */
export type AttachFn = typeof attach;

/** The driver session type, derived so webdriverio stays a type-only import. */
export type Driver = Awaited<ReturnType<RemoteFn>>;

/** The two ways onto a session: a new one, or one another runner opened. */
export type Webdriverio = { attach: AttachFn; remote: RemoteFn };

type SessionRequest = {
    bundleId: string;
    device: MobileDevice;
    launchTimeoutMs: number;
    /** The run's ledger — absent when the run shares no session. */
    ledger?: SessionLedger | undefined;
    serverUrl: string;
    /** Injected by the adapter's own tests; loaded from the optional peer otherwise. */
    webdriverio?: undefined | Webdriverio;
};

const IDLE_SESSION_BUDGET_S = 300;

const IOS_PREFIX = /^ios\s+/iu;

function platformVersion(os: string): string {
    return os.replace(IOS_PREFIX, '');
}

/** Lazy: only a spec that opens the app requires the optional peer. */
async function loadWebdriverio(): Promise<Webdriverio> {
    try {
        const { attach: attachFn, remote: remoteFn } = await import('webdriverio');
        return { attach: attachFn, remote: remoteFn };
    } catch {
        throw new Error(
            refusal('seam-is-an-optional-peer', {
                fix: 'npm install -D appium webdriverio && npx appium driver install xcuitest',
                found: '.open() requires `webdriverio`, and it is not installed',
            }),
        );
    }
}

function capabilitiesOf(request: SessionRequest): Record<string, unknown> {
    const { name, os, udid } = request.device;
    return {
        'appium:automationName': 'XCUITest',
        'appium:bundleId': request.bundleId,
        'appium:deviceName': name,
        'appium:newCommandTimeout': IDLE_SESSION_BUDGET_S,
        'appium:noReset': true,
        ...(os === undefined ? {} : { 'appium:platformVersion': platformVersion(os) }),
        ...(udid === undefined ? {} : { 'appium:udid': udid }),
        'appium:wdaLaunchTimeout': request.launchTimeoutMs,
        platformName: 'iOS',
    };
}

/** Whether the server answered the call with success; a server that does not answer did not. */
async function succeeded(url: string, method: 'DELETE' | 'GET'): Promise<boolean> {
    try {
        const response = await fetch(url, {
            method,
            signal: AbortSignal.timeout(SERVER_CALL_TIMEOUT_MS),
        });
        // Stryker disable next-line OptionalChaining: outside: Appium answers every call with a JSON body
        await response.body?.cancel();
        return response.ok;
    } catch {
        return false;
    }
}

type Recorded = ReturnType<SessionLedger['lookup']>[number];

/** Appium answers `timeouts` without a WebDriverAgent round trip, and any command restarts the session's idle clock. */
async function firstHeld(
    serverUrl: string,
    ledger: SessionLedger,
    recorded: readonly Recorded[],
): Promise<Recorded | undefined> {
    const [candidate, ...rest] = recorded;
    if (candidate === undefined) {
        return undefined;
    }
    const session = `${serverUrl}/session/${candidate.sessionId}`;
    if (await succeeded(`${session}/timeouts`, 'GET')) {
        return candidate;
    }
    await succeeded(session, 'DELETE');
    ledger.forget(candidate.sessionId);
    return await firstHeld(serverUrl, ledger, rest);
}

/** Attached to the session the run recorded for this server and capabilities, or created and recorded; `shared` sessions are the run's to end. */
export async function openSession(
    request: SessionRequest,
): Promise<{ driver: Driver; shared: boolean }> {
    const { ledger, serverUrl } = request;
    const url = new URL(serverUrl);
    const server = { hostname: url.hostname, logLevel: 'error' as const, port: Number(url.port) };
    const capabilities = capabilitiesOf(request);
    // Stryker disable next-line all: outside: the peer's own webdriverio opens a session on a real Appium server, which no module test has
    const webdriverio = request.webdriverio ?? (await loadWebdriverio());
    const held =
        ledger === undefined
            ? undefined
            : await firstHeld(serverUrl, ledger, ledger.lookup(serverUrl, capabilities));
    if (held !== undefined) {
        const driver = await webdriverio.attach({
            ...server,
            capabilities: held.capabilities,
            sessionId: held.sessionId,
        });
        return { driver, shared: true };
    }
    const driver = await webdriverio.remote({ ...server, capabilities });
    ledger?.record(capabilities, {
        capabilities: { ...driver.capabilities },
        serverUrl,
        sessionId: driver.sessionId,
    });
    return { driver, shared: ledger !== undefined };
}
