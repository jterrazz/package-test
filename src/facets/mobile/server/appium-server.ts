import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { refusal } from '../../../chain/refusals/refusal.js';
import { ServedProcess } from '../../../services/process/serve.js';
import type { MobileDevice } from '../device/device.port.js';
import { ensureBooted, resolveSimulatorUdid, sameRuntime } from './simulator.js';

const APPIUM_READY_TIMEOUT_MS = 60_000;

const APPIUM_STATUS = '/status';

export type RunServer = { device: MobileDevice; udid: string; url: string };

export type AppiumServer = {
    stop: () => Promise<void>;
    url: string;
};

/** Appium is an optional peer resolved from `node_modules/.bin`; the served process owns port, readiness and the group kill. */
export async function startAppiumServer(root: string): Promise<AppiumServer> {
    const bin = resolve(root, 'node_modules', '.bin', 'appium');
    if (!existsSync(bin)) {
        throw new Error(
            refusal('seam-is-an-optional-peer', {
                fix: 'npm install -D appium webdriverio && npx appium driver install xcuitest',
                found: `specification.mobile() requires \`appium\`, and ${bin} does not exist`,
            }),
        );
    }

    const serve = new ServedProcess(
        // outside: the served process injects `PORT`; appium reads only a flag.
        {
            command: `"${bin}" --port "$PORT"`,
            ready: APPIUM_STATUS,
            timeout: APPIUM_READY_TIMEOUT_MS,
        },
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

/** The booted simulator is the machine's and outlives the server. */
export async function serveAppium(
    device: MobileDevice,
    root: string,
): Promise<{ server: AppiumServer; udid: string }> {
    const udid = device.udid ?? (await resolveSimulatorUdid(device));
    await ensureBooted(udid);
    return { server: await startAppiumServer(root), udid };
}

/** The run's Appium server, provided by a `mobile({ device })` project's setup. */
// Stryker disable all: outside: only a mobile project's setup provides it, which no module test runs, so every read answers undefined; the mobile specs judge it
export async function mobileServer(): Promise<RunServer | undefined> {
    try {
        const { inject } = await import('vitest');
        return inject('mobileServer');
    } catch {
        return undefined;
    }
}
// Stryker restore all

function notOurs(url: string): AppiumServer {
    return {
        stop: async () => {
            // invariant: a declared server is the author's: this runner never stops what it did not start.
        },
        url,
    };
}

function named({ name, os, udid }: MobileDevice): string {
    return [
        `'${name}'`,
        os === undefined ? '' : ` (${os})`,
        udid === undefined ? '' : ` [${udid}]`,
    ].join('');
}

/** Never another device: no other simulator was booted for the run. */
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
            refusal({
                fix: 'name that device, or declare no device on mobile() so each file serves its own',
                found: `specification.mobile() names the device ${named(device)}, and the run's Appium server drives ${named({ ...run.device, udid: run.udid })}, the device its mobile({ device }) project declares`,
                read: 'docs/guides/mobile-specs.md#one-session-per-run',
                why: 'The run’s setup booted the project’s device alone.',
            }),
        );
    }
    return { ...run.device, udid: run.udid };
}

/** A declared server owns its devices; the run's server drives the one its setup booted; otherwise resolved, booted and spawned here for this file. */
export async function reachAppium(
    { appium: declared, device }: { appium?: { url: string }; device?: MobileDevice },
    root: string,
    run?: RunServer,
): Promise<{ appium: AppiumServer; device: MobileDevice; outlivesFile: boolean }> {
    if (declared !== undefined) {
        if (device === undefined) {
            throw new Error(
                refusal({
                    fix: 'name the simulator with `device: { name }`',
                    found: `specification.mobile() names no device to ask the Appium server at ${declared.url} for`,
                    read: 'docs/guides/mobile-specs.md#a-declared-appium-server',
                    why: 'A declared server is handed its device by capabilities.',
                }),
            );
        }
        return { appium: notOurs(declared.url), device, outlivesFile: true };
    }
    if (run !== undefined) {
        return { appium: notOurs(run.url), device: runDevice(device, run), outlivesFile: true };
    }
    if (device === undefined) {
        throw new Error(
            refusal({
                fix: "name the simulator with `device: { name }`, or declare it once on the project, mobile({ device, root }), so every file drives the run's",
                found: 'specification.mobile() names no device, and no mobile({ device }) project serves one',
                read: 'docs/guides/mobile-specs.md#one-session-per-run',
                why: 'A mobile spec drives one simulator, named by the runner or by its project.',
            }),
        );
    }
    const { server, udid } = await serveAppium(device, root);
    return { appium: server, device: { ...device, udid }, outlivesFile: false };
}

declare module 'vitest' {
    interface ProvidedContext {
        /** The simulator a `mobile({ device, root })` project serves one Appium server for, and where its binary is resolved from. */
        mobileAppium?: { device: MobileDevice; root: string };
        /** The run's Appium server, spawned by the project's global setup, and the simulator it drives. */
        mobileServer?: RunServer;
    }
}
