import type { SpecificationConfig } from '../../model/chain/builder.js';
import { getCallerDir } from '../../model/chain/caller.js';
import { resolveRoot } from '../../model/chain/resolve.js';
import { releaseIsolation, startServices } from '../../model/chain/services.js';
import type { ServiceRecord, StartedServices } from '../../model/chain/services.js';
import { StubBackend } from '../../model/chain/stub-backend.js';
import { registerMatchers } from '../../model/goldens/matchers.js';
import type { DevicePort, DeviceTimeouts, SessionLedger } from '../../model/ports/device.port.js';
import { mobileSessions } from '../../runner/provided.js';
import { startAppiumServer } from './appium-server.js';
import type { AppiumServer } from './appium-server.js';
import { createMobileFacet } from './mobile.chain.js';
import type { MobileSpecification } from './mobile.chain.js';
import { sessionLedger } from './session-ledger.js';
import { ensureBooted, resolveSimulatorUdid } from './simulator.js';

// ── Types ──

/**
 * The declared stub backend behind the app under test. The framework owns
 * the simulator and appium but NOT the JS bundler (Metro belongs to the
 * caller's repo, like `next build` belongs to a website's) — so nothing is
 * injected: the handle exposes `backendUrl` and the CALLER wires it into its
 * own bundler env.
 */
export type MobileBackendOptions = {
    /**
     * Fixed port — pins a stable stub URL across runs. Metro inlines
     * `EXPO_PUBLIC_*` values at bundle-serve time; a stable port lets a warm
     * Metro survive between runs. Default: a free OS-assigned port.
     */
    port?: number;
};

/** Options for {@link startMobile | specification.mobile}. */
export type MobileSpecificationOptions<Services extends ServiceRecord = ServiceRecord> = {
    /** The app under test — terminated and relaunched by every `.open()`. */
    app: {
        /** Bundle id of the installed app (`com.example.app`). */
        bundleId: string;
    };
    /**
     * An Appium server already running — a device farm, a server another
     * machine owns, a protocol double. The runner connects to it instead of
     * spawning the project's own, and hands it the device by capabilities
     * (`appium:deviceName`, `appium:platformVersion`, `appium:udid` when
     * declared) instead of resolving and booting it through `simctl`: the
     * machine the server runs on owns its simulators.
     */
    appium?: {
        /** The server's base URL (`http://127.0.0.1:4723`). */
        url: string;
    };
    /**
     * Declared stub backend: started with the runner, serving the contracts
     * each chain declares via `.intercept(...)`. The handle gains
     * `backendUrl` — inject it into your bundler env yourself.
     */
    backend?: MobileBackendOptions;
    /** The simulator to run on — resolved through `xcrun simctl`. */
    device: {
        /** Simulator name, matched exactly (`iPhone 17`). */
        name: string;
        /** OS narrowing when the name exists on several runtimes — `'26.5'` or `'iOS 26.5'`. */
        os?: string;
        /** Explicit UDID — skips name/os resolution entirely. */
        udid?: string;
    };
    /**
     * Project-root override (CONVENTIONS A9): where the appium binary is
     * resolved from (`node_modules/.bin`). Auto-discovered from the calling
     * file when absent.
     */
    root?: string;
    /**
     * How long this runner's session waits, in milliseconds — every field
     * optional, each falling back to the framework's default. A project
     * driving a DEV build states the wait its bundler's cold boot needs
     * (`{ action: 45_000 }`) instead of sleeping inside its scenarios.
     */
    /**
     * Named services started with the runner and stopped with it — a
     * `process()` for the bundler the app loads from, a database a dev build
     * reads. Metro stops being a `beforeAll` the repository maintains: it is
     * `process({ command: 'expo start', ready: /Metro waiting on .*:(\\d+)/ })`
     * like every other external process the framework owns.
     */
    services?: Services;
    timeouts?: DeviceTimeouts;
};

/**
 * The record returned by {@link startMobile | specification.mobile}.
 * Destructure with the canonical names (CONVENTIONS A3):
 *
 *     const { mobile, cleanup, udid } = await specification.mobile(…);
 */
export type MobileHandle = {
    /**
     * Base URL of the declared stub backend — present only with the
     * `backend` option. The caller injects it into its own bundler env
     * (e.g. `EXPO_PUBLIC_API_URL`); the framework never touches the bundler.
     */
    backendUrl?: string | undefined;
    /**
     * End the driver session — unless it is the run's, which the project's
     * global setup ends — and stop the appium server and the stub backend.
     */
    cleanup: () => Promise<void>;
    mobile: MobileSpecification;
    /**
     * The simulator UDID the specs run against — resolved by the runner, or
     * the declared one. Absent when a declared `appium` server owns the
     * device and none was named.
     */
    udid: string | undefined;
};

// ── Constructor ──

/**
 * The Appium server the runner drives, and the simulator it asks it for. A
 * declared server owns its devices: the runner neither resolves nor boots one,
 * and stops nothing it did not start. Otherwise the simulator is resolved and
 * booted here, and the project's own server spawned beside it.
 */
async function reachAppium(
    options: MobileSpecificationOptions,
    root: string,
): Promise<{ appium: AppiumServer; udid: string | undefined }> {
    const { appium: declared, device } = options;
    if (declared !== undefined) {
        return {
            appium: {
                stop: async () => {
                    await Promise.resolve();
                },
                url: declared.url,
            },
            udid: device.udid,
        };
    }
    const udid = device.udid ?? (await resolveSimulatorUdid(device));
    await ensureBooted(udid);
    return { appium: await startAppiumServer(root), udid };
}

/**
 * The run's session ledger, when the runner may share the run's session: its
 * server outlives the file, and a `mobile()` project provided the ledger.
 */
async function runLedger(declared: boolean): Promise<SessionLedger | undefined> {
    const directory = declared ? await mobileSessions() : undefined;
    return directory === undefined ? undefined : sessionLedger(directory);
}

export async function startMobile<Services extends ServiceRecord>(
    options: MobileSpecificationOptions<Services>,
): Promise<MobileHandle> {
    // Caller detection must run before any await — async resumption drops
    // The calling file's frames from the stack.
    const callerDir = getCallerDir();
    await registerMatchers();

    const root = resolveRoot(options.root, callerDir);
    const { appium, udid } = await reachAppium(options, root);

    // The declared services come up before the app is ever launched: a dev
    // Build reaches its bundler on the first frame it renders.
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

    // The stub starts last (nothing can fail after it), so a constructor
    // Refusal never leaves an orphaned server keeping the process alive.
    let backend: null | StubBackend = null;
    let backendUrl: string | undefined;
    if (options.backend) {
        backend = new StubBackend({ port: options.backend.port });
        backendUrl = await backend.start();
    }

    // One driver session per runner, opened lazily on the first `.open()` —
    // Or, under a declared server in a `mobile()` project, one per RUN: the
    // Project's global setup provides the ledger the session is recorded in.
    // A spawned server stops with this runner, so its session cannot outlive
    // The file. The appium/webdriverio integration stays a lazy import
    // (CONVENTIONS I1) — the dependency is optional and only loaded when a
    // Spec actually opens the app.
    let device: DevicePort | null = null;
    const getDevice = async (): Promise<DevicePort> => {
        if (!device) {
            const { AppiumAdapter } = await import('../../seams/appium/appium.adapter.js');
            device = new AppiumAdapter({
                device: { name: options.device.name, os: options.device.os, udid },
                serverUrl: appium.url,
                ledger: await runLedger(options.appium !== undefined),
                timeouts: options.timeouts,
            });
        }
        return device;
    };

    const config: SpecificationConfig = {
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
        mobile: createMobileFacet(config),
        udid,
    };
}
