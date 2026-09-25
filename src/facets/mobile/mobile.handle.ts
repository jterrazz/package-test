import { getCallerDir } from '../../model/chain/caller.js';
import type { StartedWith } from '../../model/chain/config.js';
import { resolveRoot } from '../../model/chain/resolve.js';
import { registerMatchers } from '../../model/goldens/matchers.js';
import type { DevicePort, DeviceTimeouts, SessionLedger } from '../../model/ports/device.port.js';
import { releaseIsolation, startServices } from '../../model/services/services.js';
import type { ServiceRecord, StartedServices } from '../../model/services/services.js';
import { mobileServer, mobileSessions } from '../../runner/provided.js';
import { serveAppium } from '../../seams/appium/appium-server.js';
import type { AppiumServer, MobileDevice, RunServer } from '../../seams/appium/appium-server.js';
import { sessionLedger } from '../../seams/appium/session-ledger.js';
import { sameRuntime } from '../../seams/simctl/simulator.js';
import { StubBackend } from '../../seams/stub-backend/stub-backend.js';
import type { MobileSpecification } from './mobile.facet.js';
import { mobileFacet } from './mobile.facet.js';

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
     * Declared stub backend: started with the runner, serving the stubs
     * each chain declares via `.intercept(...)`. The handle gains
     * `backendUrl` — inject it into your bundler env yourself.
     */
    backend?: MobileBackendOptions;
    /**
     * The simulator to run on — resolved through `xcrun simctl`, or asked of
     * a declared `appium` server. Under a `mobile({ device })` project the
     * run's server already drives one, and the project owns it: left out
     * here, the runner drives the project's; stated, it restates that device,
     * never another, and the booted UDID stands for a device that declares
     * none. Anywhere else a runner with no device is refused.
     */
    device?: MobileDevice;
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
     * global setup ends — and stop the appium server this runner spawned and
     * the stub backend.
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

/** A server this runner did not start, and so never stops. */
function notOurs(url: string): AppiumServer {
    return {
        stop: async () => {
            await Promise.resolve();
        },
        url,
    };
}

/** A device as a refusal names it. */
function named({ name, os, udid }: MobileDevice): string {
    return [
        `'${name}'`,
        os === undefined ? '' : ` (${os})`,
        udid === undefined ? '' : ` [${udid}]`,
    ].join('');
}

/**
 * The device a runner asks the run's server for: the one the project declared
 * and the setup booted. A specification leaves it out or restates it, and
 * never names another — no other simulator was booted for the run.
 */
export function runDevice(device: MobileDevice | undefined, run: RunServer): MobileDevice {
    if (device === undefined) {
        return { ...run.device, udid: run.udid };
    }
    const agrees =
        device.name === run.device.name &&
        (device.os === undefined ||
            (run.device.os !== undefined && sameRuntime(device.os, run.device.os))) &&
        (device.udid === undefined || device.udid === run.udid);
    if (!agrees) {
        throw new Error(
            `specification.mobile() names the device ${named(device)}, and the run's Appium server drives ${named({ ...run.device, udid: run.udid })}, the device its mobile({ device }) project declares — name that device, or declare no device on mobile() so each file serves its own`,
        );
    }
    return { ...run.device, udid: run.udid };
}

/**
 * The Appium server the runner drives, the simulator it asks it for, and
 * whether that server outlives the file. A declared server owns its devices:
 * the runner neither resolves nor boots one. The run's server, spawned by a
 * `mobile({ device })` project's global setup, drives the device that setup
 * booted, whether the runner restates it or leaves it to the project.
 * Otherwise the simulator is resolved and booted here, and the project's own
 * server spawned beside it, for this file alone. A runner with no device and
 * no run's server to lend one is refused.
 */
async function reachAppium(
    options: MobileSpecificationOptions,
    root: string,
): Promise<{ appium: AppiumServer; device: MobileDevice; outlivesFile: boolean }> {
    const { appium: declared, device } = options;
    if (declared !== undefined) {
        if (device === undefined) {
            throw new Error(
                `specification.mobile() names no device to ask the Appium server at ${declared.url} for — a declared server is handed its device by capabilities: name the simulator with \`device: { name }\``,
            );
        }
        return { appium: notOurs(declared.url), device, outlivesFile: true };
    }
    const run = await mobileServer();
    if (run !== undefined) {
        return { appium: notOurs(run.url), device: runDevice(device, run), outlivesFile: true };
    }
    if (device === undefined) {
        throw new Error(
            "specification.mobile() names no device, and no mobile({ device }) project serves one — name the simulator with `device: { name }`, or declare it once on the project, mobile({ device, root }), so every file drives the run's",
        );
    }
    const { server, udid } = await serveAppium(device, root);
    return { appium: server, device: { ...device, udid }, outlivesFile: false };
}

/**
 * The run's session ledger, when the runner may share the run's session: its
 * server outlives the file, and a `mobile()` project provided the ledger.
 */
async function runLedger(outlivesFile: boolean): Promise<SessionLedger | undefined> {
    const directory = outlivesFile ? await mobileSessions() : undefined;
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
    const { appium, device: driven, outlivesFile } = await reachAppium(options, root);

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
    // Or, under a server that outlives the file (a declared one, or the run's
    // Own) in a `mobile()` project, one per RUN: the project's global setup
    // Provides the ledger the session is recorded in. A server this runner
    // Spawned stops with it, so its session cannot outlive the file. The
    // Appium/webdriverio integration stays a lazy import
    // (CONVENTIONS I1) — the dependency is optional and only loaded when a
    // Spec actually opens the app.
    let device: DevicePort | null = null;
    const getDevice = async (): Promise<DevicePort> => {
        if (!device) {
            const { AppiumAdapter } = await import('../../seams/appium/appium.adapter.js');
            device = new AppiumAdapter({
                device: driven,
                serverUrl: appium.url,
                ledger: await runLedger(outlivesFile),
                timeouts: options.timeouts,
            });
        }
        return device;
    };

    const config: StartedWith<'bundleId' | 'device'> = {
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
