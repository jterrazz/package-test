import { mkdtempSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { evidenceDirectory } from '../../../../lint/kit/project/artifacts.js';
import { pause } from '../../../chain/pause.js';
import { refusal } from '../../../chain/refusals/refusal.js';
import { scenarioFailure } from '../../../chain/refusals/scenario-failure.js';
import { asWritten } from '../../../visitor/targets/as-written.js';
import { scopeChain } from '../../../visitor/targets/landmarks.js';
import type { Target } from '../../../visitor/targets/target.js';
import { openSession } from '../session/driver-session.js';
import type { AttachFn, Driver, RemoteFn } from '../session/driver-session.js';
import type { SessionLedger } from '../session/session-ledger.js';
import { ambiguousScreenElementError } from './ambiguous.js';
import type {
    DeviceOpenOptions,
    DevicePort,
    DeviceScreen,
    DeviceTimeouts,
    MobileDevice,
    MobileVisitor,
} from './device.port.js';
import { projectScreen } from './projection.js';
import { captureMatches, matching, onScreenLabels, scrollToOffscreen } from './xcui-query.js';
import type { DriverElement, MatchScope } from './xcui-query.js';

/* outside: 30s absorbs a cold app boot, as playwright's actionability default; a slower app raises `timeouts`. */
const DEFAULT_ACTION_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 500;
/** WebDriverAgent builds once per simulator: the first session is the slow one. */
const DEFAULT_WDA_LAUNCH_TIMEOUT_MS = 240_000;

/** One driver session, opened lazily and reused: WebDriverAgent startup is the expensive part. Every `open()` relaunches the app. */
export class AppiumAdapter implements DevicePort {
    private readonly actionTimeoutMs: number;
    private readonly attach?: AttachFn | undefined;
    private driver: Driver | null = null;
    private readonly launchTimeoutMs: number;
    private readonly ledger?: SessionLedger | undefined;
    private readonly options: { device: MobileDevice; serverUrl: string };
    /** Injected by the unit test; production loads webdriverio lazily. */
    private readonly remote?: RemoteFn | undefined;
    private shared = false;

    constructor(options: {
        attach?: AttachFn | undefined;
        device: MobileDevice;
        ledger?: SessionLedger | undefined;
        remote?: RemoteFn | undefined;
        serverUrl: string;
        timeouts?: DeviceTimeouts | undefined;
    }) {
        this.options = { device: options.device, serverUrl: options.serverUrl };
        this.attach = options.attach;
        this.ledger = options.ledger;
        this.remote = options.remote;
        this.actionTimeoutMs = options.timeouts?.action ?? DEFAULT_ACTION_TIMEOUT_MS;
        this.launchTimeoutMs = options.timeouts?.launch ?? DEFAULT_WDA_LAUNCH_TIMEOUT_MS;
    }

    async close(): Promise<void> {
        if (this.driver && !this.shared) {
            await this.driver.deleteSession();
        }
        this.driver = null;
    }

    async open(options: DeviceOpenOptions): Promise<DeviceScreen> {
        const driver = await this.session(options.bundleId);

        // invariant: every open terminates the app first, then relaunches it.
        try {
            await driver.executeScript('mobile: terminateApp', [{ bundleId: options.bundleId }]);
        } catch {
            // invariant: the app was not running — a fresh state already.
        }
        await (options.deepLink === undefined
            ? driver.executeScript('mobile: activateApp', [{ bundleId: options.bundleId }])
            : driver.executeScript('mobile: deepLink', [
                  { bundleId: options.bundleId, url: options.deepLink },
              ]));

        if (options.scenario) {
            try {
                await options.scenario(this.createVisitor(driver));
            } catch (error) {
                const evidence = await this.captureEvidence(driver);
                throw scenarioFailure(error, evidence, 'open');
            }
        }

        return projectScreen(await driver.getPageSource());
    }

    /** `see()` acts on nothing, so any visible match satisfies it: XCUITest trees duplicate labels across container and child. */
    private createVisitor(driver: Driver): MobileVisitor {
        return {
            fill: async (target, value) => {
                const match = await this.resolveOne(driver, target, 'fill', 'one');
                await match.setValue(value);
            },
            see: async (target) => {
                await this.resolveOne(driver, target, 'see', 'any');
            },
            tap: async (target) => {
                const match = await this.resolveOne(driver, target, 'tap', 'one');
                await match.click();
            },
        };
    }

    /** Scopes stay strict in both modes; the chain resolves outside-in, so an ambiguous scope names itself. */
    private async resolveOne(
        driver: Driver,
        target: Target,
        verb: string,
        cardinality: 'any' | 'one',
    ): Promise<DriverElement> {
        const chain = scopeChain(target);
        const deadline = Date.now() + this.actionTimeoutMs;

        /* invariant: the scroll fallback takes an expensive unfiltered snapshot: once, on the first miss. */
        let scrollAttempted = false;
        for (;;) {
            const resolved = await this.resolveChain(driver, chain, cardinality, {
                tryScroll: !scrollAttempted,
            });
            scrollAttempted = true;
            if (resolved) {
                return resolved;
            }
            if (Date.now() > deadline) {
                throw await this.timeoutError(driver, target, verb);
            }
            await pause(POLL_INTERVAL_MS);
        }
    }

    private async resolveChain(
        driver: Driver,
        chain: Target[],
        cardinality: 'any' | 'one',
        options?: { tryScroll?: boolean },
    ): Promise<DriverElement | null> {
        let scope: MatchScope = driver;
        let element: DriverElement | null = null;
        for (const [index, level] of chain.entries()) {
            const matches = await matching(scope, level);
            const count = await matches.length;
            if (count === 0) {
                if (options?.tryScroll === true) {
                    await scrollToOffscreen(driver, scope, level);
                }
                return null;
            }
            const isTarget = index === chain.length - 1;
            if (count > 1 && (cardinality === 'one' || !isTarget)) {
                throw ambiguousScreenElementError({
                    target: level,
                    matches: await captureMatches(matches),
                });
            }
            const next = matches[0];
            if (next === undefined) {
                return null;
            }
            scope = next;
            element = next;
        }
        return element;
    }

    /** Screenshot the failing state into a temp file; never masks the original error. */
    private async captureEvidence(driver: Driver): Promise<null | string> {
        try {
            const dir = mkdtempSync(evidenceDirectory('mobile-'));
            const path = resolve(dir, 'failure.png');
            writeFileSync(path, Buffer.from(await driver.takeScreenshot(), 'base64'));
            return path;
        } catch {
            return null;
        }
    }

    private async timeoutError(driver: Driver, target: Target, verb: string): Promise<Error> {
        let excerpt = '';
        try {
            const source = await driver.getPageSource();
            const labels = onScreenLabels(source);
            if (labels.length > 0) {
                excerpt = `\nCurrently on screen: ${labels.join(' | ')}`;
            }
        } catch {
            // invariant: the excerpt is best-effort evidence — never mask the timeout.
        }
        return new Error(
            refusal({
                fix: 'designate what this screen shows, or raise `timeouts.action` for a slow build',
                found: `${verb}(${asWritten(target)}) timed out after ${this.actionTimeoutMs}ms — no visible match.${excerpt}`,
                read: 'docs/11-mobile.md#declared-timeouts',
                why: 'A mobile verb waits for one visible match, within the declared action budget.',
            }),
        );
    }

    private async session(bundleId: string): Promise<Driver> {
        if (this.driver) {
            return this.driver;
        }
        const opened = await openSession({
            attach: this.attach,
            bundleId,
            device: this.options.device,
            launchTimeoutMs: this.launchTimeoutMs,
            ledger: this.ledger,
            remote: this.remote,
            serverUrl: this.options.serverUrl,
        });
        this.shared = opened.shared;
        this.driver = opened.driver;
        return this.driver;
    }
}
