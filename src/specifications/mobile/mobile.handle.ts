import { resolveRoot } from '../../../lint/kit/project/resolve.js';
import type { Started } from '../../chain/config.js';
import { getCallerDir } from '../../chain/paths/caller.js';
import { registerMatchers } from '../../expectations/goldens/matchers.js';
import { declaredServices } from '../../services/services.js';
import type { ServiceRecord } from '../../services/services.js';
import { releaseIsolation, startServices } from '../../services/startup/start-services.js';
import type { StartedServices } from '../../services/startup/start-services.js';
import { StubBackend } from '../../stubs/delivery/other-process/stub-backend.js';
import type { StubsConfig } from '../../stubs/delivery/other-process/stub-backend.js';
import type { DevicePort, DeviceTimeouts, MobileDevice } from './device/device.port.js';
import type { MobileSpecification } from './mobile.composition.js';
import { mobileDefinition } from './mobile.composition.js';
import { mobileServer, reachAppium } from './server/appium-server.js';
import type { SessionLedger } from './session/session-ledger.js';
import { mobileSessions, sessionLedger } from './session/session-ledger.js';

export type MobileConfig = StubsConfig & {
    bundleId?: string | undefined;
    device?: (() => Promise<DevicePort>) | undefined;
};

/** The stub backend behind the app; nothing is injected: wire `backendUrl` into your own bundler env. */
export type MobileBackendOptions = {
    /** Fixed port: Metro inlines `EXPO_PUBLIC_*` at serve time, so a stable port keeps a warm Metro valid. */
    port?: number;
};

/** Options for {@link startMobile | specification.mobile}. */
export type MobileSpecificationOptions<Services extends ServiceRecord = ServiceRecord> = {
    /** The app under test — terminated and relaunched by every `.open()`. */
    app: {
        bundleId: string;
    };
    /** An Appium server already running; it owns its simulators, handed the device by capabilities. */
    appium?: {
        url: string;
    };
    /** Stub backend serving each chain's `.intercept(...)`; the handle gains `backendUrl`. */
    backend?: MobileBackendOptions;
    /** The simulator to run on; under a `mobile({ device })` project it restates the project's, never another. */
    device?: MobileDevice;
    /** Project-root override (`no-redundant-root`): where the appium binary is resolved from. */
    root?: string;
    /** Services started and stopped with the runner, such as a `process()` for the bundler. */
    services?: Services;
    /** How long this runner's session waits; a dev build states what its bundler's cold boot needs. */
    timeouts?: DeviceTimeouts;
};

/** What `specification.mobile()` returns: `const { mobile, cleanup, udid } = …` (`no-runner-alias`). */
export type MobileHandle = {
    /** Base URL of the stub backend, with the `backend` option; inject it into your bundler env. */
    backendUrl?: string | undefined;
    /** End the driver session (unless it is the run's), the appium server this runner spawned, and the stub backend. */
    cleanup: () => Promise<void>;
    mobile: MobileSpecification;
    /** The simulator UDID; absent when a declared `appium` server owns an unnamed device. */
    udid: string | undefined;
};

// Stryker disable BlockStatement,ConditionalExpression,EqualityOperator: only a mobile project's setup provides the run's ledger folder, which no module test runs; the mobile specs judge it
async function runLedger(outlivesFile: boolean): Promise<SessionLedger | undefined> {
    const directory = outlivesFile ? await mobileSessions() : undefined;
    return directory === undefined ? undefined : sessionLedger(directory);
}
// Stryker restore all

/** invariant: one session per runner; per run under a server that outlives the file. A server this runner spawned stops with it. */
function lazyDevice(session: {
    driven: MobileDevice;
    ledger: () => Promise<SessionLedger | undefined>;
    serverUrl: string;
    timeouts: DeviceTimeouts | undefined;
}): { close: () => Promise<void>; get: () => Promise<DevicePort> } {
    let device: DevicePort | null = null;
    return {
        close: async () => {
            await device?.close();
            device = null;
        },
        get: async () => {
            if (!device) {
                const { AppiumAdapter } = await import('./device/appium.adapter.js');
                device = new AppiumAdapter({
                    device: session.driven,
                    ledger: await session.ledger(),
                    serverUrl: session.serverUrl,
                    timeouts: session.timeouts,
                });
            }
            return device;
        },
    };
}

async function startBesideAppium(
    services: ServiceRecord,
    root: string,
    appium: { stop: () => Promise<void> },
): Promise<null | StartedServices> {
    if (Object.keys(services).length === 0) {
        return null;
    }
    try {
        return await startServices(services, root, { type: 'none' });
    } catch (error) {
        await appium.stop();
        throw error;
    }
}

export async function startMobile<Services extends ServiceRecord>(
    options: MobileSpecificationOptions<Services>,
): Promise<MobileHandle> {
    const callerDir = getCallerDir();
    await registerMatchers();

    const root = resolveRoot(options.root, callerDir);
    const {
        appium,
        device: driven,
        outlivesFile,
    } = await reachAppium(options, root, await mobileServer());

    // invariant: services come up before the app launches: a dev build reaches its bundler on its first frame.
    const services = declaredServices(options.services);
    const started = await startBesideAppium(services, root, appium);

    // invariant: the stub starts last, so a constructor refusal never orphans a server.
    let backend: null | StubBackend = null;
    let backendUrl: string | undefined;
    if (options.backend) {
        // Stryker disable next-line ObjectLiteral: the port option is the stub backend's own, held by its tests: a module test reads no port it was handed
        backend = new StubBackend({ port: options.backend.port });
        backendUrl = await backend.start();
    }

    const device = lazyDevice({
        driven,
        // Stryker disable next-line ArrowFunction: see runLedger
        ledger: async () => await runLedger(outlivesFile),
        serverUrl: appium.url,
        timeouts: options.timeouts,
    });

    const config: Started<MobileConfig, 'bundleId' | 'device'> = {
        backend: backend ?? undefined,
        backendUrl,
        bundleId: options.app.bundleId,
        device: device.get,
    };

    return {
        backendUrl,
        cleanup: async () => {
            await device.close();
            if (started) {
                await started.stopProcesses();
                await releaseIsolation(services);
                await started.orchestrator.stop();
            }
            await appium.stop();
            if (backend) {
                await backend.stop();
            }
        },
        mobile: mobileDefinition.open(config),
        udid: driven.udid,
    };
}
