import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { ServedProcess } from '../../../world/services/process/serve.js';
import type { MobileDevice } from '../device/device.port.js';
import { ensureBooted, resolveSimulatorUdid, sameRuntime } from './simulator.js';

const APPIUM_READY_TIMEOUT_MS = 60_000;

/**
 * The guidance thrown when the optional peers are missing — the exact fix,
 * mirroring the playwright message on `.visit()`.
 */
const APPIUM_INSTALL_HINT =
    'specification.mobile() requires appium and webdriverio (optional peer dependencies): npm install -D appium webdriverio && npx appium driver install xcuitest';

/** The run's Appium server as a worker reads it: where it answers, the device the project declared, and the simulator booted for it. */
export type RunServer = { device: MobileDevice; udid: string; url: string };

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
 * served process's — one implementation for every child the framework spawns.
 */
export async function startAppiumServer(root: string): Promise<AppiumServer> {
    const bin = resolve(root, 'node_modules', '.bin', 'appium');
    if (!existsSync(bin)) {
        throw new Error(APPIUM_INSTALL_HINT);
    }

    const serve = new ServedProcess(
        // The served process injects its free port as `PORT`; appium only
        // reads a flag, so the shell forwards one into the other.
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

/**
 * The run's Appium server, read on the worker's side — what a
 * `mobile({ device })` project's global setup spawned and provides;
 * `undefined` when each runner reaches its own.
 */
async function mobileServer(): Promise<RunServer | undefined> {
    try {
        const { inject } = await import('vitest');
        return inject('mobileServer');
    } catch {
        return undefined;
    }
}

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
export async function reachAppium(
    { appium: declared, device }: { appium?: { url: string }; device?: MobileDevice },
    root: string,
): Promise<{ appium: AppiumServer; device: MobileDevice; outlivesFile: boolean }> {
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

/** What a `mobile()` project hands its global setup, and what that setup hands the workers. */
declare module 'vitest' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- a module augmentation MERGES only as an interface; a type alias redeclares the name and every member is lost
    interface ProvidedContext {
        /** The simulator a `mobile({ device, root })` project serves one Appium server for, and where its binary is resolved from. */
        mobileAppium?: { device: MobileDevice; root: string };
        /** The run's Appium server, spawned by the project's global setup, and the simulator it drives. */
        mobileServer?: RunServer;
    }
}
