import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { isRecord } from '../../../../../lint/kit/project/json-shape.js';
import { alive, programNamed } from '../../../../services/process/__tests__/serve.fixtures.js';
import {
    isListening,
    statusOf,
} from '../../../../stubs/delivery/other-process/__tests__/stub-backend.fixtures.js';
import { reachAppium, runDevice, startAppiumServer } from '../appium-server.js';

const run = {
    device: { name: 'iPhone 17', os: '26.5' },
    udid: 'SIM-17',
    url: 'http://127.0.0.1:4723',
};

/** A project root whose appium spawns each named program — its path, then its arguments — in a group of its own, for a minute at most, writes their pids to `spawned.json`, then answers on the port its flag names. */
function appiumSpawning(programs: Record<string, string[]>): string {
    const root = mkdtempSync(resolve(tmpdir(), 'appium-root-'));
    mkdirSync(resolve(root, 'node_modules/.bin'), { recursive: true });
    writeFileSync(
        resolve(root, 'appium.mjs'),
        [
            "import { spawn } from 'node:child_process';",
            "import { writeFileSync } from 'node:fs';",
            "import { createServer } from 'node:http';",
            `const programs = ${JSON.stringify(programs)};`,
            "const spawned = Object.fromEntries(Object.entries(programs).map(([name, [program, ...args]]) => [name, spawn(program, ['-e', 'setTimeout(() => {}, 60000)', ...args], { detached: true, stdio: 'ignore' }).pid]));",
            "writeFileSync('spawned.json', JSON.stringify(spawned));",
            "createServer((q, s) => s.end()).listen(Number(process.argv[process.argv.indexOf('--port') + 1]));",
        ].join('\n'),
    );
    writeFileSync(
        resolve(root, 'node_modules/.bin/appium'),
        `#!/bin/sh\nexec node "${resolve(root, 'appium.mjs')}" "$@"\n`,
        { mode: 0o755 },
    );
    return root;
}

function spawnedBy(root: string): Record<string, number> {
    const read: unknown = JSON.parse(readFileSync(resolve(root, 'spawned.json'), 'utf8'));
    return isRecord(read)
        ? Object.fromEntries(Object.entries(read).map(([name, pid]) => [name, Number(pid)]))
        : {};
}

describe('appium-server', () => {
    test('startAppiumServer — refuses a root with no appium binary, naming the install command', async () => {
        // Given - a project root where appium was never installed (the run's temp root removes it)
        const root = mkdtempSync(resolve(tmpdir(), 'appium-root-'));

        // Then - the refusal is the exact fix, and nothing is spawned
        await expect(startAppiumServer(root, 'SIM-17')).rejects.toThrow(
            new Error(
                [
                    `found: specification.mobile() requires \`appium\`, and ${root}/node_modules/.bin/appium does not exist`,
                    'why: Every seam is an optional peer of @jterrazz/test, installed by the project that specifies through it.',
                    'fix: npm install -D appium webdriverio && npx appium driver install xcuitest',
                    'read: docs/reference/linting.md#seam-is-an-optional-peer',
                ].join('\n'),
            ),
        );
    });

    test("runDevice — the device the run serves — a specification restating the project's device drives the booted simulator", () => {
        // Given - the same name, the os left out
        // Then - the project's device, on the udid the setup booted
        expect(runDevice({ name: 'iPhone 17', udid: 'SIM-17' }, run)).toStrictEqual({
            name: 'iPhone 17',
            os: '26.5',
            udid: 'SIM-17',
        });
        expect(runDevice({ name: 'iPhone 17' }, run)).toStrictEqual({
            name: 'iPhone 17',
            os: '26.5',
            udid: 'SIM-17',
        });
    });

    test("runDevice — the device the run serves — a specification naming no device drives the project's, on the booted simulator", () => {
        // Given - no device on the specification
        // Then - the project's device, on the udid the setup booted
        expect(runDevice(undefined, run)).toStrictEqual({
            name: 'iPhone 17',
            os: '26.5',
            udid: 'SIM-17',
        });
    });

    test("runDevice — the device the run serves — a specification spelling the project's os another way drives the booted simulator", () => {
        // Given - the os with its platform, in another case, where the project wrote the bare version
        // Then - the same runtime, so the project's device on the booted udid
        expect(runDevice({ name: 'iPhone 17', os: 'IOS 26.5' }, run)).toStrictEqual({
            name: 'iPhone 17',
            os: '26.5',
            udid: 'SIM-17',
        });
        expect(
            runDevice(
                { name: 'iPhone 17', os: '26.5' },
                { ...run, device: { name: 'iPhone 17', os: 'iOS 26.5' } },
            ),
        ).toStrictEqual({ name: 'iPhone 17', os: 'iOS 26.5', udid: 'SIM-17' });
    });

    test('runDevice — the device the run serves — a specification naming another device is refused, naming both', () => {
        // Given - another name, the same name on another os or platform, an os the run cannot confirm, another udid
        // Then - each is refused with the device the run drives
        expect(() => runDevice({ name: 'iPad Pro' }, run)).toThrow(
            [
                "found: specification.mobile() names the device 'iPad Pro', and the run's Appium server drives 'iPhone 17' (26.5) [SIM-17], the device its mobile({ device }) project declares",
                'why: The run’s setup booted the project’s device alone.',
                'fix: name that device, or declare no device on mobile() so each file serves its own',
                'read: docs/guides/mobile-specs.md#one-session-per-run',
            ].join('\n'),
        );
        expect(() => runDevice({ name: 'iPhone 17', os: '18.0' }, run)).toThrow(
            "names the device 'iPhone 17' (18.0)",
        );
        expect(() =>
            runDevice(
                { name: 'iPhone 17', os: 'tvOS 26.5' },
                { ...run, device: { name: 'iPhone 17', os: 'iOS 26.5' } },
            ),
        ).toThrow("names the device 'iPhone 17' (tvOS 26.5)");
        expect(() =>
            runDevice({ name: 'iPhone 17', os: '26.5' }, { ...run, device: { name: 'iPhone 17' } }),
        ).toThrow("names the device 'iPhone 17' (26.5)");
        expect(() => runDevice({ name: 'iPhone 17', udid: 'SIM-OTHER' }, run)).toThrow(
            "names the device 'iPhone 17' [SIM-OTHER]",
        );
    });

    test('reachAppium — a declared server is the author’s, handed the device, and outlives the file; the run’s drives the project’s device', async () => {
        // Given - a declared server with a device, and the run's server with none named
        const root = mkdtempSync(resolve(tmpdir(), 'appium-root-'));
        const declared = await reachAppium(
            { appium: { url: 'http://127.0.0.1:9999' }, device: { name: 'iPad' } },
            root,
            run,
        );
        const ofTheRun = await reachAppium({}, root, run);

        // Then - neither is this runner's to stop, both outlive the file
        await declared.appium.stop();
        expect([
            { ...declared, appium: declared.appium.url },
            { ...ofTheRun, appium: ofTheRun.appium.url },
        ]).toStrictEqual([
            { appium: 'http://127.0.0.1:9999', device: { name: 'iPad' }, outlivesFile: true },
            {
                appium: 'http://127.0.0.1:4723',
                device: { name: 'iPhone 17', os: '26.5', udid: 'SIM-17' },
                outlivesFile: true,
            },
        ]);
    });

    test('reachAppium — a runner naming no device is refused under a declared server, and where no run serves one', async () => {
        // Given - a declared server and no device, then neither
        const root = mkdtempSync(resolve(tmpdir(), 'appium-root-'));

        // Then - each refusal, whole
        await expect(
            reachAppium({ appium: { url: 'http://127.0.0.1:9999' } }, root, run),
        ).rejects.toThrow(
            new Error(
                [
                    'found: specification.mobile() names no device to ask the Appium server at http://127.0.0.1:9999 for',
                    'why: A declared server is handed its device by capabilities.',
                    'fix: name the simulator with `device: { name }`',
                    'read: docs/guides/mobile-specs.md#a-declared-appium-server',
                ].join('\n'),
            ),
        );
        await expect(reachAppium({}, root)).rejects.toThrow(
            new Error(
                [
                    'found: specification.mobile() names no device, and no mobile({ device }) project serves one',
                    'why: A mobile spec drives one simulator, named by the runner or by its project.',
                    "fix: name the simulator with `device: { name }`, or declare it once on the project, mobile({ device, root }), so every file drives the run's",
                    'read: docs/guides/mobile-specs.md#one-session-per-run',
                ].join('\n'),
            ),
        );
    });

    test('startAppiumServer — serves the project’s appium on the port it picks, until stopped with the WebDriverAgent it spawned for its simulator', async () => {
        // Given - a root whose appium spawns, each in a group of its own, the xcodebuild and runner app of its simulator's WebDriverAgent beside three it must leave alone, then answers its status on the port its flag names; and one whose appium exits
        const udid = 'APPIUM-SERVER-STOP-SIM';
        const xcodebuild = programNamed('xcodebuild');
        const runner = `Devices/${udid}/data/WebDriverAgentRunner-Runner.app/WebDriverAgentRunner-Runner`;
        const otherRunner =
            'Devices/OTHER-SIM/data/WebDriverAgentRunner-Runner.app/WebDriverAgentRunner-Runner';
        const root = appiumSpawning({
            appXcodebuild: [xcodebuild, 'MyApp.xcodeproj', `id=${udid}`],
            otherRunner: [programNamed(otherRunner)],
            otherXcodebuild: [xcodebuild, 'WebDriverAgent.xcodeproj', 'id=OTHER-SIM'],
            runner: [programNamed(runner)],
            xcodebuild: [xcodebuild, 'WebDriverAgent.xcodeproj', `id=${udid}`],
        });

        const failing = mkdtempSync(resolve(tmpdir(), 'appium-root-'));
        mkdirSync(resolve(failing, 'node_modules/.bin'), { recursive: true });
        writeFileSync(
            resolve(failing, 'node_modules/.bin/appium'),
            '#!/bin/sh\necho no driver\nexit 1\n',
            {
                mode: 0o755,
            },
        );

        // When - it is served, then stopped, and one that exits is served
        const exited = await startAppiumServer(failing, udid).catch((error: unknown) => error);
        const server = await startAppiumServer(root, udid);
        const answered = await statusOf(`${server.url}/status`);
        const spawned = spawnedBy(root);
        const served = Object.values(spawned).every((pid) => alive(pid));
        await server.stop();
        const listening = await isListening(server.url);
        const left = Object.entries(spawned).filter(([, pid]) => alive(pid));
        for (const [, pid] of left) {
            process.kill(pid, 'SIGKILL');
        }

        // Then - it answered while served, and neither it nor its simulator's WebDriverAgent outlives the stop, which leaves the others alone; the one that exited is refused for the mobile runner
        expect([
            answered,
            served,
            listening,
            left.map(([name]) => name).toSorted(),
            exited instanceof Error && exited.message.split('\n')[0],
        ]).toStrictEqual([
            200,
            true,
            false,
            ['appXcodebuild', 'otherRunner', 'otherXcodebuild'],
            'found: specification.mobile(): the server command exited before it was ready.',
        ]);
    });

    test('reachAppium — a runner naming its device where no run serves one boots it itself, and is refused a simulator it cannot boot', async () => {
        // Given - a device named by a udid no machine has
        const root = mkdtempSync(resolve(tmpdir(), 'appium-root-'));

        // Then - the boot is refused, naming the simulator
        const refused = await reachAppium(
            { device: { name: 'Nothing', udid: 'NO-SUCH-UDID' } },
            root,
        ).catch((error: unknown) => error);
        const lines = refused instanceof Error ? refused.message.split('\n') : [];
        expect([
            lines[0],
            lines.slice(-3),
            refused instanceof Error && refused.cause instanceof Error,
        ]).toStrictEqual([
            'found: specification.mobile(): could not boot simulator NO-SUCH-UDID.',
            [
                'why: A mobile spec runs on a simulator the machine can boot.',
                'fix: boot it by hand (`xcrun simctl boot <udid>`) and correct what simctl names',
                'read: docs/guides/mobile-specs.md#requirements--what-the-machine-must-have',
            ],
            true,
        ]);
    });
});
