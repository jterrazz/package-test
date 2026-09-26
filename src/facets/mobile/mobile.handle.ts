import { registerMatchers } from '../../expectations/goldens/matchers.js';
import type { Started } from '../../kernel/chain/config.js';
import { getCallerDir } from '../../kernel/files/caller.js';
import { resolveRoot } from '../../kernel/files/resolve.js';
import type { ServiceRecord } from '../../world/services/services.js';
import { releaseIsolation, startServices } from '../../world/services/startup/start-services.js';
import type { StartedServices } from '../../world/services/startup/start-services.js';
import { StubBackend } from '../../world/stubs/backend/stub-backend.js';
import type { StubsConfig } from '../../world/stubs/backend/stub-backend.js';
import type { DevicePort, DeviceTimeouts, MobileDevice } from './device/device.port.js';
import type { MobileSpecification } from './mobile.facet.js';
import { mobileFacet } from './mobile.facet.js';
import { reachAppium } from './server/appium-server.js';
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

async function runLedger(outlivesFile: boolean): Promise<SessionLedger | undefined> {
    const directory = outlivesFile ? await mobileSessions() : undefined;
    return directory === undefined ? undefined : sessionLedger(directory);
}

export async function startMobile<Services extends ServiceRecord>(
    options: MobileSpecificationOptions<Services>,
): Promise<MobileHandle> {
    const callerDir = getCallerDir();
    await registerMatchers();

    const root = resolveRoot(options.root, callerDir);
    const { appium, device: driven, outlivesFile } = await reachAppium(options, root);

    // Services come up before the app launches: a dev build reaches its bundler on its first frame.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the empty record stands for an absent one, and every facet states the default the same way
    const services = (options.services ?? {}) as Services;
    let started: null | StartedServices = null;
    if (Object.keys(services).length > 0) {
        try {
            started = await startServices(services, root, { type: 'none' });
        } catch (error) {
            await appium.stop();
            throw error;
        }
    }

    // The stub starts last, so a constructor refusal never orphans a server.
    let backend: null | StubBackend = null;
    let backendUrl: string | undefined;
    if (options.backend) {
        backend = new StubBackend({ port: options.backend.port });
        backendUrl = await backend.start();
    }

    // One session per runner; per run under a server that outlives the file. A server this runner spawned stops with it.
    let device: DevicePort | null = null;
    const getDevice = async (): Promise<DevicePort> => {
        if (!device) {
            const { AppiumAdapter } = await import('./device/appium.adapter.js');
            device = new AppiumAdapter({
                device: driven,
                serverUrl: appium.url,
                ledger: await runLedger(outlivesFile),
                timeouts: options.timeouts,
            });
        }
        return device;
    };

    const config: Started<MobileConfig, 'bundleId' | 'device'> = {
        backend: backend ?? undefined,
        backendUrl,
        bundleId: options.app.bundleId,
        device: getDevice,
    };

    return {
        backendUrl,
        cleanup: async () => {
            if (device) {
                await device.close();
                device = null;
            }
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
        mobile: mobileFacet.open(config),
        udid: driven.udid,
    };
}
