import { registerMatchers } from '../../../vitest/matchers.js';
import type { DevicePort } from '../../ports/device.port.js';
import {
    createMobileFacet,
    type MobileSpecification,
    type SpecificationConfig,
} from '../shared/builder.js';
import { getCallerDir } from '../shared/caller.js';
import { resolveRoot } from '../shared/resolve.js';
import { startAppiumServer } from './appium-server.js';
import { ensureBooted, resolveSimulatorUdid } from './simulator.js';

// ── Types ──

/** Options for {@link startMobile | specification.mobile}. */
export interface MobileSpecificationOptions {
    /** The app under test — terminated and relaunched by every `.open()`. */
    app: {
        /** Bundle id of the installed app (`com.example.app`). */
        bundleId: string;
    };
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
}

/**
 * The record returned by {@link startMobile | specification.mobile}.
 * Destructure with the canonical names (CONVENTIONS A3):
 *
 *     const { mobile, cleanup, udid } = await specification.mobile(…);
 */
export interface MobileHandle {
    /** End the driver session and stop the appium server. */
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

    // One driver session per runner, created lazily on the first `.open()`.
    // The appium/webdriverio integration stays a lazy import (CONVENTIONS
    // I1) — the dependency is optional and only loaded when a spec actually
    // Opens the app.
    let device: DevicePort | null = null;
    const getDevice = async (): Promise<DevicePort> => {
        if (!device) {
            const { AppiumAdapter } =
                await import('../../../integrations/appium/appium.adapter.js');
            device = new AppiumAdapter({ serverUrl: appium.url, udid });
        }
        return device;
    };

    const config: SpecificationConfig = {
        bundleId: options.app.bundleId,
        device: getDevice,
    };

    return {
        cleanup: async () => {
            if (device) {
                await device.close();
                device = null;
            }
            await appium.stop();
        },
        mobile: createMobileFacet(config),
        udid,
    };
}
