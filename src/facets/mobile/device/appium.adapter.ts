import { mkdtempSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { evidenceDirectory } from '../../../../lint/engine/project/artifacts.js';
import { refusal } from '../../../../lint/refusal.js';
import { scenarioFailure } from '../../../kernel/refusals/scenario-failure.js';
import { MAX_REPORTED_MATCHES, shortened } from '../../../visitor/matching/candidates.js';
import { asWritten } from '../../../visitor/targets/as-written.js';
import { scopeChain } from '../../../visitor/targets/landmarks.js';
import type { Target } from '../../../visitor/targets/target.js';
import { openSession } from '../session/driver-session.js';
import type { AttachFn, Driver, RemoteFn } from '../session/driver-session.js';
import type { SessionLedger } from '../session/session-ledger.js';
import { ambiguousScreenElementError } from './ambiguity.js';
import type {
    DeviceOpenOptions,
    DevicePort,
    DeviceScreen,
    DeviceTimeouts,
    MobileDevice,
    MobileElementKind,
    MobileElementMatch,
    MobileVisitor,
} from './device.port.js';
import { projectScreen } from './projection.js';

type ElementList = Awaited<ReturnType<Driver['$$']>>;

type DriverElement = ElementList[number];

type MatchScope = Driver | DriverElement;

/* 30s absorbs a cold app boot, as playwright's actionability default; a slower app raises `timeouts`. */
const DEFAULT_ACTION_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 500;
/** WebDriverAgent builds once per simulator: the first session is the slow one. */
const DEFAULT_WDA_LAUNCH_TIMEOUT_MS = 240_000;

const delay = async (ms: number): Promise<void> => {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
};

function escapePredicate(value: string): string {
    return value.replaceAll('\\', String.raw`\\`).replaceAll("'", String.raw`\'`);
}

type PredicateParts = {
    contains: (attribute: string) => string;
    name: string;
    visible: string;
};

const PREDICATES: Record<MobileElementKind, (parts: PredicateParts) => string> = {
    button: ({ contains, visible }) =>
        `type == 'XCUIElementTypeButton' AND ${contains('label')} AND ${visible}`,
    field: ({ contains, visible }) =>
        `type IN {'XCUIElementTypeTextField','XCUIElementTypeSecureTextField'}` +
        ` AND (${contains('label')} OR ${contains('value')}) AND ${visible}`,
    testId: ({ name, visible }) => `name == '${name}' AND ${visible}`,
    text: ({ contains, visible }) =>
        `(${contains('label')} OR ${contains('value')}) AND ${visible}`,
};

function isMobileKind(kind: Target['kind']): kind is MobileElementKind {
    return Object.hasOwn(PREDICATES, kind);
}

/** Landmarks have no XCUITest analog: the boundary is refused, not approximated. */
function compilePredicate(element: Target, options?: { anyVisibility?: boolean }): string {
    if (!isMobileKind(element.kind)) {
        throw new Error(
            refusal('no-landmark-on-mobile', {
                fix: `scope with within(testId('…'), …) — any target works as the scope`,
                found: `${asWritten(element)}, a landmark — an iOS screen has no '${element.kind}' region`,
            }),
        );
    }
    const name = escapePredicate(element.name ?? '');
    return PREDICATES[element.kind]({
        contains: (attribute) =>
            element.exact === false
                ? `${attribute} CONTAINS '${name}'`
                : `${attribute} == '${name}'`,
        name,
        visible: options?.anyVisibility ? '1 == 1' : 'visible == 1',
    });
}

/** `$$` answers a chainable typed as its array: the one await of it lives here. */
async function matching(
    scope: MatchScope,
    element: Target,
    options?: { anyVisibility?: boolean },
): Promise<ElementList> {
    /* oxlint-disable typescript/await-thenable -- webdriverio's chainable is TYPED as the array it resolves to and is a promise at runtime: the await is what runs the query */
    /* oxlint-disable typescript/return-await -- same reason: the value returned is a promise, whatever its type says */
    return await scope.$$(`-ios predicate string:${compilePredicate(element, options)}`);
    /* oxlint-enable typescript/return-await */
    /* oxlint-enable typescript/await-thenable */
}

async function captureMatch(element: DriverElement): Promise<MobileElementMatch> {
    const [type, label, value, identifier] = await Promise.all([
        element.getAttribute('type'),
        element.getAttribute('label'),
        element.getAttribute('value'),
        element.getAttribute('name'),
    ]);
    const shortLabel = label ? shortened(label) : undefined;
    return {
        type: (type ?? 'Unknown').replace(/^XCUIElementType/u, ''),
        ...(shortLabel === undefined ? {} : { label: shortLabel }),
        ...(value && value !== label ? { value } : {}),
        ...(identifier && identifier !== label ? { identifier } : {}),
    };
}

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

        // Every open terminates the app first, then relaunches it.
        try {
            await driver.executeScript('mobile: terminateApp', [{ bundleId: options.bundleId }]);
        } catch {
            // The app was not running — a fresh state already.
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
            fill: async (element, value) => {
                const match = await this.resolveOne(driver, element, 'fill', 'one');
                await match.setValue(value);
            },
            see: async (element) => {
                await this.resolveOne(driver, element, 'see', 'any');
            },
            tap: async (element) => {
                const match = await this.resolveOne(driver, element, 'tap', 'one');
                await match.click();
            },
        };
    }

    /** Scopes stay strict in both modes; the chain resolves outside-in, so an ambiguous scope names itself. */
    private async resolveOne(
        driver: Driver,
        element: Target,
        verb: string,
        cardinality: 'any' | 'one',
    ): Promise<DriverElement> {
        const chain = scopeChain(element);
        const deadline = Date.now() + this.actionTimeoutMs;

        /* The scroll fallback takes an expensive unfiltered snapshot: once, on the first miss. */
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
                throw await this.timeoutError(driver, element, verb);
            }
            await delay(POLL_INTERVAL_MS);
        }
    }

    private async resolveChain(
        driver: Driver,
        chain: Target[],
        cardinality: 'any' | 'one',
        options?: { tryScroll?: boolean },
    ): Promise<DriverElement | null> {
        let scope: MatchScope = driver;
        for (const [index, level] of chain.entries()) {
            const matches = await matching(scope, level);
            const count = await matches.length;
            if (count === 0) {
                /* Actionability includes scroll-into-view: the next pass re-resolves the element as visible. */
                if (options?.tryScroll) {
                    const offscreen = await matching(scope, level, { anyVisibility: true });
                    const first = offscreen[0];
                    if (first !== undefined) {
                        try {
                            // `mobile: scroll`'s `toVisible` is for table and collection views: scroll the found element by id.
                            await driver.executeScript('mobile: scrollToElement', [
                                { elementId: first.elementId },
                            ]);
                        } catch {
                            // Not scrollable (or already settling) — keep polling.
                        }
                    }
                }
                return null;
            }
            const isTarget = index === chain.length - 1;
            if (count > 1 && (cardinality === 'one' || !isTarget)) {
                throw ambiguousScreenElementError({
                    element: level,
                    matches: await this.captureMatches(matches),
                });
            }
            const next = matches[0];
            if (next === undefined) {
                return null;
            }
            scope = next;
        }
        return scope as DriverElement;
    }

    private async captureMatches(matches: ElementList): Promise<MobileElementMatch[]> {
        const count = Math.min(await matches.length, MAX_REPORTED_MATCHES);
        const evidence: MobileElementMatch[] = [];
        for (let index = 0; index < count; index++) {
            const match = matches[index];
            if (match !== undefined) {
                evidence.push(await captureMatch(match));
            }
        }
        return evidence;
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

    private async timeoutError(driver: Driver, element: Target, verb: string): Promise<Error> {
        let excerpt = '';
        try {
            const source = await driver.getPageSource();
            const labels = [
                ...new Set(
                    [...source.matchAll(/label="(?<label>[^"]{2,60})"/gu)].map(
                        (match) => match.groups?.label ?? '',
                    ),
                ),
            ].slice(0, 15);
            if (labels.length > 0) {
                excerpt = `\nCurrently on screen: ${labels.join(' | ')}`;
            }
        } catch {
            // The excerpt is best-effort evidence — never mask the timeout.
        }
        return new Error(
            refusal({
                fix: 'designate what this screen shows, or raise `timeouts.action` for a slow build',
                found: `${verb}(${asWritten(element)}) timed out after ${this.actionTimeoutMs}ms — no visible match.${excerpt}`,
                read: 'docs/09-mobile.md#declared-timeouts',
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
