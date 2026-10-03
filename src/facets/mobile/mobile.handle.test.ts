import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { processService } from '../../services/process/process.adapter.js';
import { sqlite } from '../../services/sqlite/sqlite.adapter.js';
import { statusOf } from '../../stubs/delivery/other-process/stub-backend.fixtures.js';
import { http } from '../../stubs/kinds/http.js';
import { fakeAppium, freePort } from './fake-appium.fixtures.js';
import { startMobile } from './mobile.handle.js';

/** Names a device no machine has, with no appium binary in the root: a handle coming back proves neither `simctl` nor a spawn ran. */
const ABSENT_DEVICE = { name: 'No Such Phone', os: '1.0' };

const bareRoot = (): string => mkdtempSync(join(tmpdir(), 'mobile-root-'));

describe('startMobile', () => {
    test('mobile.handle — startMobile — a declared appium server — connects without resolving, booting or spawning anything', async () => {
        // Given - a server someone else runs, and a project with no appium of its own
        const handle = await startMobile({
            app: { bundleId: 'com.example.app' },
            appium: { url: 'http://127.0.0.1:4723' },
            device: ABSENT_DEVICE,
            root: bareRoot(),
        });

        // Then - no simulator was resolved, so none is named
        expect(handle.udid).toBeUndefined();
        await handle.cleanup();
    });

    test('mobile.handle — startMobile — a declared appium server — hands a declared udid through untouched', async () => {
        // Given - a server someone else runs, and the one simulator it should drive
        const handle = await startMobile({
            app: { bundleId: 'com.example.app' },
            appium: { url: 'http://127.0.0.1:4723' },
            device: { ...ABSENT_DEVICE, udid: 'SIM-UDID' },
            root: bareRoot(),
        });

        // Then - the handle names the declared simulator
        expect(handle.udid).toBe('SIM-UDID');
        await handle.cleanup();
    });

    test('mobile.handle — startMobile — a runner with no device — is refused when no run serves one, naming the project declaration', async () => {
        // Given - no device, no declared server, and no mobile({ device }) project around the file
        // Then - the constructor refuses before resolving or spawning anything
        await expect(
            startMobile({ app: { bundleId: 'com.example.app' }, root: bareRoot() }),
        ).rejects.toThrow(
            [
                'found: specification.mobile() names no device, and no mobile({ device }) project serves one',
                'why: A mobile spec drives one simulator, named by the runner or by its project.',
                "fix: name the simulator with `device: { name }`, or declare it once on the project, mobile({ device, root }), so every file drives the run's",
                'read: docs/11-mobile.md#one-session-per-run',
            ].join('\n'),
        );
    });

    test('mobile.handle — startMobile — a runner with no device — is refused under a declared server, which is handed its device by capabilities', async () => {
        // Given - a server someone else runs, and no device to ask it for
        // Then - the constructor refuses, naming the server
        await expect(
            startMobile({
                app: { bundleId: 'com.example.app' },
                appium: { url: 'http://127.0.0.1:4723' },
                root: bareRoot(),
            }),
        ).rejects.toThrow(
            'specification.mobile() names no device to ask the Appium server at http://127.0.0.1:4723 for',
        );
    });

    test('mobile.handle — startMobile — a declared appium server — opens the app through webdriverio, reads the screen, and its cleanup ends the session and stops the backend', async () => {
        // Given - a server someone else runs, and a runner with a stub backend
        const appium = await fakeAppium(
            '<XCUIElementTypeApplication label="App"><XCUIElementTypeStaticText label="Orders" visible="true"/></XCUIElementTypeApplication>',
        );
        const port = await freePort();
        const printed = vi.spyOn(console, 'log').mockReturnValue();
        const handle = await startMobile({
            app: { bundleId: 'com.example.app' },
            appium: { url: appium.url },
            backend: { port },
            device: { name: 'iPhone 17', udid: 'SIM-UDID' },
            root: bareRoot(),
        });
        const unarmed = await statusOf(`${handle.backendUrl ?? ''}/events`);

        // When - it opens a deep link with a stub, then the app plainly, then cleans up
        const result = await handle.mobile
            .intercept({ request: http.get('/events'), response: http.json([1]) })
            .open('app://orders');
        const armed = await statusOf(`${handle.backendUrl ?? ''}/events`);
        await handle.mobile.open();
        await handle.cleanup();

        // Then - no services, so no report printed; the backend on its port and armed by the chain; the screen read, one session for both opens and ended, the backend gone
        const lines = printed.mock.calls.flat().map(String);
        printed.mockRestore();
        expect([
            lines,
            handle.backendUrl,
            [unarmed, armed],
            result.content.text,
            appium.calls,
        ]).toStrictEqual([
            [],
            `http://127.0.0.1:${port}`,
            [501, 200],
            'Orders',
            [
                'POST /session',
                'GET /session/:id/window',
                'POST /session/:id/execute/sync mobile: terminateApp',
                'POST /session/:id/execute/sync mobile: deepLink',
                'GET /session/:id/source',
                'POST /session/:id/execute/sync mobile: terminateApp',
                'POST /session/:id/execute/sync mobile: activateApp',
                'GET /session/:id/source',
                'DELETE /session/:id',
            ],
        ]);
        await expect(fetch(`${handle.backendUrl ?? ''}/events`)).rejects.toThrow(TypeError);
    });

    test('mobile.handle — startMobile — services — come up before the app and stop with the cleanup', async () => {
        // Given - a runner over a declared server, with a database and a bundler beside the app
        const printed = vi.spyOn(console, 'log').mockReturnValue();
        const bundler = processService({
            command: `node -e "require('node:http').createServer((q, s) => s.end('ok')).listen(process.env.PORT)"`,
            ready: '/',
        });
        const handle = await startMobile({
            app: { bundleId: 'com.example.app' },
            appium: { url: 'http://127.0.0.1:4723' },
            device: ABSENT_DEVICE,
            root: bareRoot(),
            services: { bundler, db: sqlite() },
        });
        const answered = await statusOf(bundler.connectionString);
        const lines = printed.mock.calls.flat().map(String);
        printed.mockRestore();

        // When - the runner cleans up
        await handle.cleanup();

        // Then - the report printed names no app, the bundler answered while the runner lived, and no longer does
        expect([
            lines.some((line) => line.includes('Starting infrastructure')),
            lines.some((line) => line.includes('app:')),
            answered,
        ]).toStrictEqual([true, false, 200]);
        await expect(fetch(bundler.connectionString)).rejects.toThrow(TypeError);
    });
});
