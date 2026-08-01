import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

/**
 * Simulator resolution — `device: { name, os? }` → one booted UDID.
 *
 * The selection logic is pure (`simctl list` JSON in, one device out) so the
 * refusals are unit-testable; only the thin wrappers below shell out to
 * `xcrun`. Zero matches and several matches both refuse with the full device
 * listing — the framework never guesses which simulator a spec meant.
 */

const run = promisify(execFile);
const BOOT_TIMEOUT_MS = 120_000;

/** One simulator known to `simctl`, flattened out of the per-runtime listing. */
export interface SimulatorDevice {
    name: string;
    /** Human OS label derived from the runtime key — `iOS 26.5`. */
    os: string;
    state: string;
    udid: string;
}

/** The shape of `xcrun simctl list devices --json` this module reads. */
interface SimctlList {
    devices: Record<string, { isAvailable?: boolean; name: string; state: string; udid: string }[]>;
}

/** `com.apple.CoreSimulator.SimRuntime.iOS-26-5` → `iOS 26.5`. */
function runtimeLabel(runtime: string): string {
    const match = /SimRuntime\.(?<platform>[A-Za-z]+)-(?<version>[\d-]+)$/.exec(runtime);
    return match?.groups
        ? `${match.groups['platform']} ${match.groups['version'].replaceAll('-', '.')}`
        : runtime;
}

/** Flatten the per-runtime record into one available-device list. */
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

/** `iOS 26.5` matches `os: 'iOS 26.5'` and the bare version `'26.5'`, case-insensitive. */
function osMatches(deviceOs: string, wanted: string): boolean {
    const normalized = wanted.toLowerCase();
    return deviceOs.toLowerCase() === normalized || deviceOs.split(' ')[1] === wanted;
}

function formatListing(devices: SimulatorDevice[]): string {
    return devices
        .map((device) => `  ${device.name} — ${device.os} (${device.state}) ${device.udid}`)
        .join('\n');
}

/**
 * Pick exactly one simulator by name (and OS when given). Zero or several
 * matches refuse with the listing needed to fix the options without opening
 * Xcode.
 */
export function selectSimulator(
    listJson: string,
    criteria: { name: string; os?: string },
): SimulatorDevice {
    const available = listSimulators(listJson);
    const matches = available.filter(
        (device) =>
            device.name === criteria.name &&
            (criteria.os === undefined || osMatches(device.os, criteria.os)),
    );

    const wanted =
        criteria.os === undefined ? `"${criteria.name}"` : `"${criteria.name}" on ${criteria.os}`;
    if (matches.length === 0) {
        throw new Error(
            `specification.mobile(): no simulator matches ${wanted}.\nAvailable devices:\n${formatListing(available)}`,
        );
    }
    if (matches.length > 1) {
        throw new Error(
            `specification.mobile(): ${matches.length} simulators match ${wanted} — add \`os:\` or \`udid:\` to pick one.\nMatched:\n${formatListing(matches)}`,
        );
    }
    return matches[0];
}

/** Resolve `device: { name, os? }` to a UDID via `xcrun simctl`. */
export async function resolveSimulatorUdid(criteria: {
    name: string;
    os?: string;
}): Promise<string> {
    const { stdout } = await run('xcrun', ['simctl', 'list', 'devices', '--json'], {
        maxBuffer: 16 * 1024 * 1024,
    });
    return selectSimulator(stdout, criteria).udid;
}

/**
 * Boot the simulator when it is shut down and wait until it reports Booted.
 * Idempotent: booting an already-booted device is tolerated, and
 * `bootstatus -b` returns immediately when the device is up.
 */
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
