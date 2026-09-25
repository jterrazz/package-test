import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

/** Zero or several matches refuse with the full listing: the framework never guesses the simulator. */

const run = promisify(execFile);
const BOOT_TIMEOUT_MS = 120_000;

export type SimulatorDevice = {
    name: string;
    /** Human OS label derived from the runtime key — `iOS 26.5`. */
    os: string;
    state: string;
    udid: string;
};

type SimctlList = {
    devices: Record<string, { isAvailable?: boolean; name: string; state: string; udid: string }[]>;
};

function runtimeLabel(runtime: string): string {
    const match = /SimRuntime\.(?<platform>[A-Za-z]+)-(?<version>[\d-]+)$/u.exec(runtime);
    const platform = match?.groups?.platform;
    const version = match?.groups?.version;
    return platform === undefined || version === undefined
        ? runtime
        : `${platform} ${version.replaceAll('-', '.')}`;
}

export function listSimulators(listJson: string): SimulatorDevice[] {
    const parsed = JSON.parse(listJson) as SimctlList;
    return Object.entries(parsed.devices).flatMap(([runtime, devices]) =>
        devices
            .filter((device) => device.isAvailable !== false)
            .map((device) => ({
                name: device.name,
                os: runtimeLabel(runtime),
                state: device.state,
                udid: device.udid,
            })),
    );
}

function runtimeOf(os: string): { platform: string | undefined; version: string } {
    const [first = '', second] = os.trim().toLowerCase().split(/\s+/u);
    return second === undefined
        ? { platform: undefined, version: first }
        : { platform: first, version: second };
}

/** `'iOS 26.5'` and `'26.5'` name one runtime; two naming platforms must name the same one. */
export function sameRuntime(one: string, other: string): boolean {
    const [a, b] = [runtimeOf(one), runtimeOf(other)];
    return (
        a.version === b.version &&
        (a.platform === undefined || b.platform === undefined || a.platform === b.platform)
    );
}

function formatListing(devices: SimulatorDevice[]): string {
    return devices
        .map((device) => `  ${device.name} — ${device.os} (${device.state}) ${device.udid}`)
        .join('\n');
}

export function selectSimulator(
    listJson: string,
    criteria: { name: string; os?: string },
): SimulatorDevice {
    const available = listSimulators(listJson);
    const matches = available.filter(
        (device) =>
            device.name === criteria.name &&
            (criteria.os === undefined || sameRuntime(device.os, criteria.os)),
    );

    const wanted =
        criteria.os === undefined ? `"${criteria.name}"` : `"${criteria.name}" on ${criteria.os}`;
    const [only] = matches;
    if (only === undefined) {
        throw new Error(
            `specification.mobile(): no simulator matches ${wanted}.\nAvailable devices:\n${formatListing(available)}`,
        );
    }
    if (matches.length > 1) {
        throw new Error(
            `specification.mobile(): ${matches.length} simulators match ${wanted} — add \`os:\` or \`udid:\` to pick one.\nMatched:\n${formatListing(matches)}`,
        );
    }
    return only;
}

export async function resolveSimulatorUdid(criteria: {
    name: string;
    os?: string;
}): Promise<string> {
    const { stdout } = await run('xcrun', ['simctl', 'list', 'devices', '--json'], {
        maxBuffer: 16 * 1024 * 1024,
    });
    return selectSimulator(stdout, criteria).udid;
}

/** Idempotent: an already-booted device is tolerated. */
export async function ensureBooted(udid: string): Promise<void> {
    try {
        await run('xcrun', ['simctl', 'boot', udid]);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // "Unable to boot device in current state: Booted" — already up.
        if (!message.includes('current state: Booted')) {
            throw new Error(
                `specification.mobile(): could not boot simulator ${udid}.\n${message}`,
                { cause: error },
            );
        }
    }
    await run('xcrun', ['simctl', 'bootstatus', udid, '-b'], { timeout: BOOT_TIMEOUT_MS });
}
