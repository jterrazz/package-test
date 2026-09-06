import { registerMatchers } from '../../../vitest/matchers.js';
import type { DevicePort, DeviceTimeouts } from '../../ports/device.port.js';
import {
    createMobileFacet,
    type MobileSpecification,
    type SpecificationConfig,
} from '../shared/builder.js';
import { getCallerDir } from '../shared/caller.js';
import { resolveRoot } from '../shared/resolve.js';
import { StubBackend } from '../shared/stub-backend.js';
import { startAppiumServer } from './appium-server.js';
import { ensureBooted, resolveSimulatorUdid } from './simulator.js';

// ── Types ──

/**
 * The declared stub backend behind the app under test. The framework owns
 * the simulator and appium but NOT the JS bundler (Metro belongs to the
 * caller's repo, like `next build` belongs to a website's) — so nothing is
 * injected: the handle exposes `backendUrl` and the CALLER wires it into its
 * own bundler env.
 */
export interface MobileBackendOptions {
    /**
     * Fixed port — pins a stable stub URL across runs. Metro inlines
     * `EXPO_PUBLIC_*` values at bundle-serve time; a stable port lets a warm
     * Metro survive between runs. Default: a free OS-assigned port.
     */
    port?: number;
}

/** Options for {@link startMobile | specification.mobile}. */
export interface MobileSpecificationOptions {
    /** The app under test — terminated and relaunched by every `.open()`. */
    app: {
        /** Bundle id of the installed app (`com.example.app`). */
        bundleId: string;
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
    timeouts?: DeviceTimeouts;
}

/**
 * The record returned by {@link startMobile | specification.mobile}.
 * Destructure with the canonical names (CONVENTIONS A3):
 *
 *     const { mobile, cleanup, udid } = await specification.mobile(…);
 */
export interface MobileHandle {
    /**
     * Base URL of the declared stub backend — present only with the
     * `backend` option. The caller injects it into its own bundler env
     * (e.g. `EXPO_PUBLIC_API_URL`); the framework never touches the bundler.
     */
    backendUrl?: string;
    /** End the driver session, stop the appium server and the stub backend. */
    cleanup: () => Promise<void>;
    mobile: MobileSpecification;
    /** The resolved simulator UDID the specs run against. */
    udid: string;
}

// ── Constructor ──

export async function startMobile(options: MobileSpecificationOptions): Promise<MobileHandle> {
    // Caller detection must run before any await — async resumption drops
    // The calling file's frames from the stack.
    const callerDir = getCallerDir();
    await registerMatchers();

    const root = resolveRoot(options.root, callerDir);
    const udid = options.device.udid ?? (await resolveSimulatorUdid(options.device));
    await ensureBooted(udid);
    const appium = await startAppiumServer(root);

    // The stub starts last (nothing can fail after it), so a constructor
    // Refusal never leaves an orphaned server keeping the process alive.
    let backend: null | StubBackend = null;
    let backendUrl: string | undefined;
    if (options.backend) {
        backend = new StubBackend({ port: options.backend.port });
        backendUrl = await backend.start();
    }

    // One driver session per runner, created lazily on the first `.open()`.
    // The appium/webdriverio integration stays a lazy import (CONVENTIONS
    // I1) — the dependency is optional and only loaded when a spec actually
    // Opens the app.
    let device: DevicePort | null = null;
    const getDevice = async (): Promise<DevicePort> => {
        if (!device) {
            const { AppiumAdapter } =
                await import('../../../integrations/appium/appium.adapter.js');
            device = new AppiumAdapter({
                serverUrl: appium.url,
                timeouts: options.timeouts,
                udid,
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
            await appium.stop();
            if (backend) {
                await backend.stop();
            }
        },
        mobile: createMobileFacet(config),
        udid,
    };
}
