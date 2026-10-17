import { execFile } from 'node:child_process';

import { isRecord } from '../../../../lint/kit/project/json-shape.js';
import { refusal } from '../../../chain/refusals/refusal.js';

// outside: zero or several matches refuse with the full listing: the framework never guesses the simulator.

// Stryker disable ArrayDeclaration,BlockStatement,CallExpression,ConditionalExpression,EqualityOperator,ObjectLiteral,StringLiteral: simctl answers only on a Mac with Xcode; the mobile specs judge what it is asked and how its answer reads
async function run(
    command: string,
    args: readonly string[],
    options: { maxBuffer?: number; timeout?: number } = {},
): Promise<{ stdout: string }> {
    return await new Promise((resolve, reject) => {
        execFile(command, args, { encoding: 'utf8', ...options }, (error, stdout) => {
            if (error === null) {
                resolve({ stdout });
            } else {
                const failure: Error = error;
                reject(failure);
            }
        });
    });
}

// hazard: until Xcode's first launch is done, every `xcrun simctl` starts `xcodebuild -runFirstLaunch`, which waits for an administrator and never answers.
let firstLaunch: Promise<unknown> | undefined;

async function simctl(
    args: readonly string[],
    options: { maxBuffer?: number; timeout?: number } = {},
): Promise<{ stdout: string }> {
    firstLaunch ??= run('xcodebuild', ['-checkFirstLaunchStatus']);
    await firstLaunch;
    return await run('xcrun', ['simctl', ...args], options);
}
// Stryker restore all

const BOOT_TIMEOUT_MS = 120_000;

export type SimulatorDevice = {
    name: string;
    /** Human OS label derived from the runtime key: `iOS 26.5`. */
    os: string;
    state: string;
    udid: string;
};

type SimctlDevices = Record<
    string,
    { isAvailable?: boolean; name: string; state: string; udid: string }[]
>;

const isSimctlDevices = (value: unknown): value is SimctlDevices =>
    isRecord(value) && Object.values(value).every((devices) => Array.isArray(devices));

const RUNTIME_KEY = /^.*SimRuntime\.(?<platform>[A-Za-z]+)-(?<version>[\d-]+)$/u;

const WORDS = /\s+/u;

// outside: `com.apple.CoreSimulator.SimRuntime.iOS-26-5` reads `iOS 26.5`; a key of another shape reads as itself.
function runtimeLabel(runtime: string): string {
    return runtime.replace(
        RUNTIME_KEY,
        (_key, platform: string, version: string) => `${platform} ${version.replaceAll('-', '.')}`,
    );
}

export function listSimulators(listJson: string): SimulatorDevice[] {
    const parsed: unknown = JSON.parse(listJson);
    const devices = isRecord(parsed) && isSimctlDevices(parsed.devices) ? parsed.devices : {};
    return Object.entries(devices).flatMap(([runtime, listed]) =>
        listed
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
    const words = os.trim().split(WORDS);
    // Stryker disable next-line MethodExpression: either case compares the same
    const platform = String(words[0]).toLowerCase();
    return { platform: words.length > 1 ? platform : undefined, version: String(words.at(-1)) };
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
            refusal({
                fix: 'name one of the available devices, or create the simulator in Xcode',
                found: `specification.mobile(): no simulator matches ${wanted}.\navailable devices:\n${formatListing(available)}`,
                read: 'docs/guides/mobile-specs.md#options',
                why: 'Resolution refuses rather than guesses: a device names exactly one simulator.',
            }),
        );
    }
    if (matches.length > 1) {
        throw new Error(
            refusal({
                fix: 'add `os:` or `udid:` to pick one',
                found: `specification.mobile(): ${matches.length} simulators match ${wanted}.\nmatched:\n${formatListing(matches)}`,
                read: 'docs/guides/mobile-specs.md#options',
                why: 'Resolution refuses rather than guesses: a device names exactly one simulator.',
            }),
        );
    }
    return only;
}

export async function resolveSimulatorUdid(criteria: {
    name: string;
    os?: string;
}): Promise<string> {
    // Stryker disable next-line ArrayDeclaration,ObjectLiteral,StringLiteral: see run
    const { stdout } = await simctl(['list', 'devices', '--json'], {
        maxBuffer: 16 * 1024 * 1024,
    });
    return selectSimulator(stdout, criteria).udid;
}

/** Idempotent: an already-booted device is tolerated. */
export async function ensureBooted(udid: string): Promise<void> {
    try {
        // Stryker disable next-line ArrayDeclaration,StringLiteral: see run
        await simctl(['boot', udid]);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // outside: "Unable to boot device in current state: Booted", already up.
        // Stryker disable next-line BlockStatement,BooleanLiteral,ConditionalExpression,StringLiteral: only a Mac with a booted simulator answers it; see run
        if (!message.includes('current state: Booted')) {
            throw new Error(
                refusal({
                    fix: "finish Xcode's first launch if it asks (`sudo xcodebuild -runFirstLaunch`), boot it by hand (`xcrun simctl boot <udid>`) and correct what simctl names",
                    found: `specification.mobile(): could not boot simulator ${udid}.\n${message}`,
                    read: 'docs/guides/mobile-specs.md#requirements--what-the-machine-must-have',
                    why: 'A mobile spec runs on a simulator the machine can boot.',
                }),
                { cause: error },
            );
        }
    }
    // Stryker disable next-line ArrayDeclaration,ObjectLiteral,StringLiteral: see run
    await simctl(['bootstatus', udid, '-b'], { timeout: BOOT_TIMEOUT_MS });
}
