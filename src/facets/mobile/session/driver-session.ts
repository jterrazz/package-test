import type { attach, remote } from 'webdriverio';

import { refusal } from '../../../../lint/index.refusal.js';
import type { MobileDevice } from '../device/device.port.js';
import { SERVER_CALL_TIMEOUT_MS } from './session-ledger.js';
import type { SessionLedger } from './session-ledger.js';

/** The session factory — webdriverio's `remote`, the adapter's single seam onto a new session. */
export type RemoteFn = typeof remote;

/** The way onto a session another runner opened — webdriverio's `attach`. */
export type AttachFn = typeof attach;

/** The driver session type, derived so webdriverio stays a type-only import. */
export type Driver = Awaited<ReturnType<RemoteFn>>;

type SessionRequest = {
    /** Injected with `remote` by the adapter's own test; loaded from webdriverio otherwise. */
    attach?: AttachFn | undefined;
    bundleId: string;
    device: MobileDevice;
    launchTimeoutMs: number;
    /** The run's ledger — absent when the run shares no session. */
    ledger?: SessionLedger | undefined;
    remote?: RemoteFn | undefined;
    serverUrl: string;
};

const IDLE_SESSION_BUDGET_S = 300;

function platformVersion(os: string): string {
    return os.replace(/^ios\s+/iu, '');
}

/** Lazy: only a spec that opens the app requires the optional peer. */
async function loadWebdriverio(): Promise<{ attach: AttachFn; remote: RemoteFn }> {
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

/** Appium answers `timeouts` without a WebDriverAgent round trip, and any command restarts the session's idle clock. */
async function stillHeld(serverUrl: string, sessionId: string): Promise<boolean> {
    try {
        const response = await fetch(`${serverUrl}/session/${sessionId}/timeouts`, {
            signal: AbortSignal.timeout(SERVER_CALL_TIMEOUT_MS),
        });
        await response.body?.cancel();
        return response.ok;
    } catch {
        return false;
    }
}

async function endUnconfirmed(serverUrl: string, sessionId: string): Promise<void> {
    await fetch(`${serverUrl}/session/${sessionId}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(SERVER_CALL_TIMEOUT_MS),
    })
        .then(async (response) => await response.body?.cancel())
        .catch(() => null);
}

/** Attached to the session the run recorded for this server and capabilities, or created and recorded; `shared` sessions are the run's to end. */
export async function openSession(
    request: SessionRequest,
): Promise<{ driver: Driver; shared: boolean }> {
    const { ledger, serverUrl } = request;
    const url = new URL(serverUrl);
    const server = { hostname: url.hostname, logLevel: 'error' as const, port: Number(url.port) };
    const capabilities = capabilitiesOf(request);
    const webdriverio =
        request.remote === undefined
            ? await loadWebdriverio()
            : { attach: request.attach, remote: request.remote };
    for (const recorded of ledger?.lookup(serverUrl, capabilities) ?? []) {
        if (!(await stillHeld(serverUrl, recorded.sessionId))) {
            await endUnconfirmed(serverUrl, recorded.sessionId);
            ledger?.forget(recorded.sessionId);
        } else if (webdriverio.attach !== undefined) {
            const driver = await webdriverio.attach({
                ...server,
                capabilities: recorded.capabilities,
                sessionId: recorded.sessionId,
            });
            return { driver, shared: true };
        }
    }
    const driver = await webdriverio.remote({ ...server, capabilities });
    ledger?.record(capabilities, {
        capabilities: { ...driver.capabilities },
        serverUrl,
        sessionId: driver.sessionId,
    });
    return { driver, shared: ledger !== undefined };
}
