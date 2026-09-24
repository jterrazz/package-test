import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { ServeAdapter } from '../../seams/process/serve.adapter.js';
import { ensureBooted, resolveSimulatorUdid } from './simulator.js';

const APPIUM_READY_TIMEOUT_MS = 60_000;

/**
 * The guidance thrown when the optional peers are missing — the exact fix,
 * mirroring the playwright message on `.visit()`.
 */
export const APPIUM_INSTALL_HINT =
    'specification.mobile() requires appium and webdriverio (optional peer dependencies): npm install -D appium webdriverio && npx appium driver install xcuitest';

/** The simulator a runner drives: by name (and OS), or by its UDID. */
export type MobileDevice = {
    /** Simulator name, matched exactly (`iPhone 17`). */
    name: string;
    /** OS narrowing when the name exists on several runtimes — `'26.5'` or `'iOS 26.5'`. */
    os?: string;
    /** Explicit UDID — skips name/os resolution entirely. */
    udid?: string;
};

/** A running appium server: its base URL and a group-killing stop. */
export type AppiumServer = {
    stop: () => Promise<void>;
    url: string;
};

/**
 * Start the caller project's appium server as a child process on a free port
 * and wait until `/status` answers. The binary is resolved from the project
 * root's `node_modules/.bin` — appium is an optional peer, so its absence
 * refuses with the exact install command. Process lifecycle (free port via
 * `PORT`, readiness poll, SIGTERM→SIGKILL group escalation on stop) is the
 * serve adapter's — one implementation for every child the framework spawns.
 */
export async function startAppiumServer(root: string): Promise<AppiumServer> {
    const bin = resolve(root, 'node_modules', '.bin', 'appium');
    if (!existsSync(bin)) {
        throw new Error(APPIUM_INSTALL_HINT);
    }

    const serve = new ServeAdapter(
        // The serve adapter injects its free port as `PORT`; appium only
        // Reads a flag, so the shell forwards one into the other.
        { command: `"${bin}" --port "$PORT"`, ready: '/status', timeout: APPIUM_READY_TIMEOUT_MS },
        root,
        'mobile',
    );
    const url = await serve.start();
    return {
        stop: async () => {
            await serve.stop();
        },
        url,
    };
}

/**
 * The project's own server for one simulator: the device resolved through
 * `simctl` (unless its UDID is declared) and booted, then the server spawned
 * from `root`. What the server's stop does not end — the booted simulator —
 * is the machine's, and outlives it.
 */
export async function serveAppium(
    device: MobileDevice,
    root: string,
): Promise<{ server: AppiumServer; udid: string }> {
    const udid = device.udid ?? (await resolveSimulatorUdid(device));
    await ensureBooted(udid);
    return { server: await startAppiumServer(root), udid };
}

/** What a `mobile()` project hands its global setup, and what that setup hands the workers. */
declare module 'vitest' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- a module augmentation MERGES only as an interface; a type alias redeclares the name and every member is lost
    interface ProvidedContext {
        /** The simulator a `mobile({ device, root })` project serves one Appium server for, and where its binary is resolved from. */
        mobileAppium?: { device: MobileDevice; root: string };
        /** The run's Appium server, spawned by the project's global setup, and the simulator it drives. */
        mobileServer?: { udid: string; url: string };
    }
}
