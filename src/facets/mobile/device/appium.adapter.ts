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
    private opened: null | { driver: Driver; shared: boolean } = null;
    private readonly launchTimeoutMs: number;
    private readonly ledger?: SessionLedger | undefined;
    private readonly options: { device: MobileDevice; serverUrl: string };
    /** Injected by the unit test; production loads webdriverio lazily. */
    private readonly remote?: RemoteFn | undefined;

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
        if (this.opened?.shared === false) {
            await this.opened.driver.deleteSession();
        }
        this.opened = null;
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
                const match = await this.resolveOne(driver, target, 'fill');
                await match.setValue(value);
            },
            see: async (target) => {
                await this.resolveOne(driver, target, 'see');
            },
            tap: async (target) => {
                const match = await this.resolveOne(driver, target, 'tap');
                await match.click();
            },
        };
    }

    /** Scopes stay strict in both modes; the chain resolves outside-in, so an ambiguous scope names itself. */
    private async resolveOne(
        driver: Driver,
        target: Target,
        verb: 'fill' | 'see' | 'tap',
    ): Promise<DriverElement> {
        const chain = scopeChain(target);
        const anyTarget = verb === 'see';
        const deadline = Date.now() + this.actionTimeoutMs;

        /* invariant: the scroll fallback takes an expensive unfiltered snapshot: once, on the first miss. */
        let tryScroll = true;
        for (;;) {
            const resolved = await this.resolveChain(driver, chain, anyTarget, tryScroll);
            tryScroll = false;
            if (resolved) {
                return resolved;
            }
            // Stryker disable next-line EqualityOperator: the deadline is not met to the millisecond
            if (Date.now() > deadline) {
                throw await this.timeoutError(driver, target, verb);
            }
            await pause(POLL_INTERVAL_MS);
        }
    }

    private async resolveChain(
        driver: Driver,
        chain: Target[],
        anyTarget: boolean,
        tryScroll: boolean,
    ): Promise<DriverElement | null> {
        let scope: MatchScope = driver;
        let element: DriverElement | null = null;
        for (const [index, level] of chain.entries()) {
            const matches = await matching(scope, level);
            const first = matches[0];
            if (first === undefined) {
                if (tryScroll) {
                    await scrollToOffscreen(driver, scope, level);
                }
                return null;
            }
            const isTarget = index === chain.length - 1;
            if ((await matches.length) > 1 && (!anyTarget || !isTarget)) {
                throw ambiguousScreenElementError({
                    target: level,
                    matches: await captureMatches(matches),
                });
            }
            scope = first;
            element = first;
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
        this.opened ??= await openSession({
            attach: this.attach,
            bundleId,
            device: this.options.device,
            launchTimeoutMs: this.launchTimeoutMs,
            ledger: this.ledger,
            remote: this.remote,
            serverUrl: this.options.serverUrl,
        });
        return this.opened.driver;
    }
}
