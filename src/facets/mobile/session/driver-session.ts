import type { attach, remote } from 'webdriverio';

import type { MobileDevice } from '../device/device.port.js';
import type { SessionLedger } from './session-ledger.js';

/** The session factory — webdriverio's `remote`, the adapter's single seam onto a new session. */
export type RemoteFn = typeof remote;

/** The way onto a session another runner opened — webdriverio's `attach`. */
export type AttachFn = typeof attach;

/** The driver session type, derived so webdriverio stays a type-only import. */
export type Driver = Awaited<ReturnType<RemoteFn>>;

/** What opening a session needs: the server, the app and device, and the factories when injected. */
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

/** `'iOS 26.5'` or `'26.5'` → the `appium:platformVersion` XCUITest reads, `'26.5'`. */
function platformVersion(os: string): string {
    return os.replace(/^ios\s+/iu, '');
}

/**
 * Load webdriverio's session factories, naming the install when the optional
 * peer dependency is absent. Lazy: the dependency is only required by a spec
 * that actually opens the app.
 */
async function loadWebdriverio(): Promise<{ attach: AttachFn; remote: RemoteFn }> {
    try {
        const { attach: attachFn, remote: remoteFn } = await import('webdriverio');
        return { attach: attachFn, remote: remoteFn };
    } catch {
        throw new Error(
            '.open() requires webdriverio (optional peer dependency): npm install -D appium webdriverio && npx appium driver install xcuitest',
        );
    }
}

/** The capabilities an XCUITest session is asked for. */
function capabilitiesOf(request: SessionRequest): Record<string, unknown> {
    const { name, os, udid } = request.device;
    return {
        'appium:automationName': 'XCUITest',
        'appium:bundleId': request.bundleId,
        'appium:deviceName': name,
        'appium:noReset': true,
        ...(os === undefined ? {} : { 'appium:platformVersion': platformVersion(os) }),
        ...(udid === undefined ? {} : { 'appium:udid': udid }),
        'appium:wdaLaunchTimeout': request.launchTimeoutMs,
        platformName: 'iOS',
    };
}

/**
 * Open the driver session a runner drives: attached to the one the run
 * recorded for this server and these capabilities, or created — and then
 * recorded, when the run keeps a ledger. `shared` says the session is the
 * run's, to be ended by the run and never by the runner.
 */
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
    const recorded = ledger?.lookup(serverUrl, capabilities);
    if (recorded !== undefined && webdriverio.attach !== undefined) {
        const driver = await webdriverio.attach({
            ...server,
            capabilities: recorded.capabilities,
            sessionId: recorded.sessionId,
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
