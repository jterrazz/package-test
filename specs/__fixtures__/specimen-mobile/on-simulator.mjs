// `make test-mobile` — the mobile specs on a real iOS simulator.
//
// Builds Specimen from `ios/` (swiftc and the simulator SDK, no Xcode
// Project), installs it on the simulator `specimen.ts` names, starts an
// Appium server with the XCUITest driver (installed once under
// `.artifacts/mobile/appium/`, pinned), then runs the `mobile` project with
// `TEST_MOBILE_APPIUM_URL` pointing at that server — the same specs `make
// check` runs against the protocol double. Exits with the suite's status.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';

const APPIUM = 'appium@3.7.0';
const XCUITEST = 'xcuitest@12.13.2';
/** WebDriverAgent is built on a simulator's first session: minutes, once. */
const FIRST_SESSION_MS = 600_000;

const here = import.meta.dirname;
const root = resolve(here, '../../..');
const out = join(root, '.artifacts/mobile');
const appiumDir = join(out, 'appium');
const appiumHome = join(appiumDir, 'home');

const { simulator, specimen } = await import('./specimen.ts');

/** Run a command to completion, failing the target on a non-zero exit. */
function run(command, args, options = {}) {
    const result = spawnSync(command, args, { encoding: 'utf8', stdio: 'inherit', ...options });
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(' ')} exited ${String(result.status)}`);
    }
    return result;
}

/** Specimen.app, built for the simulator's architecture and ad-hoc signed. */
function buildApp() {
    const app = join(out, 'Specimen.app');
    mkdirSync(app, { recursive: true });
    copyFileSync(join(here, 'ios/Info.plist'), join(app, 'Info.plist'));
    const arch = process.arch === 'arm64' ? 'arm64' : 'x86_64';
    run('xcrun', [
        '--sdk',
        'iphonesimulator',
        'swiftc',
        '-parse-as-library',
        '-target',
        `${arch}-apple-ios17.0-simulator`,
        '-O',
        join(here, 'ios/Specimen.swift'),
        '-o',
        join(app, 'Specimen'),
    ]);
    run('codesign', ['--force', '--sign', '-', app]);
    return app;
}

/** The UDID of the one available simulator `specimen.ts` names, booted. */
function bootSimulator() {
    const listing = JSON.parse(
        run('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], { stdio: 'pipe' }).stdout,
    );
    const runtime = `iOS-${simulator.os.replaceAll('.', '-')}`;
    const matches = Object.entries(listing.devices)
        .filter(([key]) => key.endsWith(runtime))
        .flatMap(([, devices]) => devices)
        .filter((device) => device.name === simulator.name);
    if (matches.length !== 1) {
        throw new Error(
            `test-mobile: ${matches.length} available simulators are "${simulator.name}" on iOS ${simulator.os} — create exactly one (Xcode › Devices and Simulators)`,
        );
    }
    const [{ state, udid }] = matches;
    if (state !== 'Booted') {
        run('xcrun', ['simctl', 'boot', udid]);
    }
    run('xcrun', ['simctl', 'bootstatus', udid, '-b']);
    return udid;
}

/** The pinned Appium and XCUITest driver, installed once. */
function installAppium() {
    const bin = join(appiumDir, 'node_modules/.bin/appium');
    if (!existsSync(bin)) {
        mkdirSync(appiumDir, { recursive: true });
        writeFileSync(join(appiumDir, 'package.json'), '{ "private": true }\n');
        run('npm', ['install', '--no-audit', '--no-fund', APPIUM], { cwd: appiumDir });
    }
    if (!existsSync(join(appiumHome, 'node_modules/appium-xcuitest-driver'))) {
        run(bin, ['driver', 'install', XCUITEST], { env: { ...process.env, APPIUM_HOME: appiumHome } });
    }
    return bin;
}

/** A port the OS has just handed out and taken back. */
async function freePort() {
    const server = createServer();
    await new Promise((resolveListen) => {
        server.listen(0, '127.0.0.1', resolveListen);
    });
    const { port } = server.address();
    await new Promise((resolveClose) => {
        server.close(resolveClose);
    });
    return port;
}

/** Appium on a free port, its log under `.artifacts/mobile/`, once `/status` answers. */
async function startAppium(bin) {
    const port = await freePort();
    const log = openSync(join(out, 'appium.log'), 'w');
    const child = spawn(bin, ['--port', String(port)], {
        env: { ...process.env, APPIUM_HOME: appiumHome },
        stdio: ['ignore', log, log],
    });
    const url = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        try {
            if ((await fetch(`${url}/status`)).ok) {
                return { child, url };
            }
        } catch {
            // Not listening yet.
        }
        await new Promise((resolveWait) => {
            setTimeout(resolveWait, 500);
        });
    }
    child.kill('SIGKILL');
    throw new Error(`test-mobile: appium did not answer on ${url} — see ${join(out, 'appium.log')}`);
}

// Each process is matched by its program's own name and the words its
// Command line holds, never by a pattern over every command line: a shell
// Whose command merely mentions WebDriverAgent and the UDID is left alone.
function endWebDriverAgent(udid) {
    const listed = (column) =>
        new Map(
            spawnSync('ps', ['-A', '-o', `pid=,${column}=`], { encoding: 'utf8' })
                .stdout.split('\n')
                .flatMap((line) => {
                    const found = /^\s*(\d+)\s(.*)$/u.exec(line);
                    return found === null ? [] : [[Number(found[1]), found[2]]];
                }),
        );
    const commands = listed('command');
    const strays = [
        { holds: ['WebDriverAgent', `id=${udid}`], program: 'xcodebuild' },
        { holds: [`/Devices/${udid}/`], program: 'WebDriverAgentRunner-Runner' },
    ];
    for (const [pid, program] of listed('comm')) {
        const stray = strays.some(
            (one) =>
                (program === one.program || program.endsWith(`/${one.program}`)) &&
                one.holds.every((word) => (commands.get(pid) ?? '').includes(word)),
        );
        if (stray) {
            try {
                process.kill(pid, 'SIGTERM');
            } catch {
                // Already gone.
            }
        }
    }
}

mkdirSync(out, { recursive: true });
const app = buildApp();
const udid = bootSimulator();
run('xcrun', ['simctl', 'install', udid, app]);
console.log(`test-mobile: ${specimen.name} installed on ${simulator.name} (iOS ${simulator.os}, ${udid})`);
const appium = await startAppium(installAppium());
const suite = spawnSync(
    'npx',
    ['vitest', '--run', '--project', 'mobile', `--testTimeout=${FIRST_SESSION_MS}`],
    { cwd: root, env: { ...process.env, TEST_MOBILE_APPIUM_URL: appium.url }, stdio: 'inherit' },
);
appium.child.kill('SIGTERM');
// Appium keeps WebDriverAgent's xcodebuild alive across sessions, and past
// Its own exit, and the runner app on the simulator with it: the run ends
// Both, as the specification ends the WebDriverAgent of a server it spawned.
endWebDriverAgent(udid);
process.exitCode = suite.status ?? 1;
