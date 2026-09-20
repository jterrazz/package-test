import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { remote } from 'webdriverio';

import { describeMobileAmbiguity } from '../../facets/mobile/ambiguity.js';
import { projectScreen } from '../../facets/mobile/projection.js';
import { AmbiguousElementError, formatElement } from '../../model/elements/ambiguity.js';
import { warnSubstringOnly } from '../../model/elements/substring-warning.js';
import type {
    DeviceOpenOptions,
    DevicePort,
    DeviceScreen,
    DeviceTimeouts,
    MobileElementMatch,
    MobileElementRef,
    MobileVisitor,
} from '../../model/ports/device.port.js';

/** The session factory — webdriverio's `remote`, the adapter's single seam onto it. */
type RemoteFn = typeof remote;

/** The driver session type, derived so webdriverio stays a type-only import. */
type Driver = Awaited<ReturnType<RemoteFn>>;

/** The element list a predicate search resolves to. */
type ElementList = Awaited<ReturnType<Driver['$$']>>;

/** One element resolved by a predicate search. */
type DriverElement = ElementList[number];

/**
 * Anything a predicate can search from — the session root, or a resolved
 * element when a descriptor carries a scope. Structural, so the resolution
 * loop recurses without caring which one it holds.
 */
type MatchScope = Driver | DriverElement;

/*
 * How long every verb polls for at least one visible match. 30s absorbs a
 * cold app boot (first launch after an install or a state wipe) — the same
 * default playwright chose for its actionability timeout. A project whose
 * app boots slower than that (a dev bundle building on demand) raises it
 * with the runner's `timeouts` option rather than sleeping in its specs.
 */
const DEFAULT_ACTION_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 500;
/** How many candidates the ambiguity error enumerates before truncating. */
const MAX_REPORTED_MATCHES = 10;
/** WebDriverAgent builds once per simulator — the first session is the slow one. */
const DEFAULT_WDA_LAUNCH_TIMEOUT_MS = 240_000;

const delay = async (ms: number): Promise<void> => {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
};

/** Escape a name for an NSPredicate single-quoted string literal. */
function escapePredicate(value: string): string {
    return value.replaceAll('\\', String.raw`\\`).replaceAll("'", String.raw`\'`);
}

/**
 * Translate a user-facing descriptor into an iOS predicate string. Landmarks
 * have no XCUITest analog — the shared vocabulary is wider than a screen,
 * and the boundary is named rather than silently approximated.
 */
function compilePredicate(
    element: MobileElementRef,
    options?: { anyVisibility?: boolean },
): string {
    const name = escapePredicate(element.name ?? '');
    // A label designates the WHOLE label — the same default as the
    // Web vocabulary, compiled to equality; `{ exact: false }` is the opt-out
    // And compiles to `CONTAINS`.
    const contains = (attribute: string): string =>
        element.exact === false ? `${attribute} CONTAINS '${name}'` : `${attribute} == '${name}'`;
    const visible = options?.anyVisibility ? '1 == 1' : 'visible == 1';

    switch (element.kind) {
        case 'button': {
            return `type == 'XCUIElementTypeButton' AND ${contains('label')} AND ${visible}`;
        }
        case 'field': {
            return (
                `type IN {'XCUIElementTypeTextField','XCUIElementTypeSecureTextField'}` +
                ` AND (${contains('label')} OR ${contains('value')}) AND ${visible}`
            );
        }
        case 'testId': {
            return `name == '${name}' AND ${visible}`;
        }
        case 'text': {
            return `(${contains('label')} OR ${contains('value')}) AND ${visible}`;
        }
        default: {
            throw new Error(
                `${formatElement(element)}: landmarks are a website concept — an iOS screen has no '${element.kind}' region. Scope with within(testId('…'), …) instead.`,
            );
        }
    }
}

/**
 * Every element a predicate designates under `scope`.
 *
 * ONE place awaits webdriverio's query: `$$` answers a chainable typed as the
 * array it resolves to, so the await that makes the array real reads to the
 * typechecker as an await of a non-promise.
 */
async function matching(
    scope: MatchScope,
    element: MobileElementRef,
    options?: { anyVisibility?: boolean },
): Promise<ElementList> {
    /* oxlint-disable typescript/await-thenable -- webdriverio's chainable is TYPED as the array it resolves to and is a promise at runtime: the await is what runs the query */
    /* oxlint-disable typescript/return-await -- same reason: the value returned is a promise, whatever its type says */
    return await scope.$$(`-ios predicate string:${compilePredicate(element, options)}`);
    /* oxlint-enable typescript/return-await */
    /* oxlint-enable typescript/await-thenable */
}

/** The outside-in scope chain of a descriptor, ending on the target itself. */
function scopeChain(element: MobileElementRef): MobileElementRef[] {
    const chain: MobileElementRef[] = [];
    for (let current: MobileElementRef | undefined = element; current; current = current.scope) {
        chain.unshift(current);
    }
    return chain;
}

/**
 * Load webdriverio's session factory, naming the install when the optional
 * peer dependency is absent. Lazy: the dependency is only required by a spec
 * that actually opens the app.
 */
async function loadRemote(): Promise<RemoteFn> {
    try {
        const { remote: remoteFn } = await import('webdriverio');
        return remoteFn;
    } catch {
        throw new Error(
            '.open() requires webdriverio (optional peer dependency): npm install -D appium webdriverio && npx appium driver install xcuitest',
        );
    }
}

/** Capture one candidate's evidence for the ambiguity refusal. */
async function captureMatch(element: DriverElement): Promise<MobileElementMatch> {
    const [type, label, value, identifier] = await Promise.all([
        element.getAttribute('type'),
        element.getAttribute('label'),
        element.getAttribute('value'),
        element.getAttribute('name'),
    ]);
    const shortLabel = label ? label.replaceAll(/\s+/gu, ' ').trim().slice(0, 80) : undefined;
    return {
        type: (type ?? 'Unknown').replace(/^XCUIElementType/u, ''),
        ...(shortLabel === undefined ? {} : { label: shortLabel }),
        ...(value && value !== label ? { value } : {}),
        ...(identifier && identifier !== label ? { identifier } : {}),
    };
}

/**
 * Device adapter backed by appium's XCUITest driver over webdriverio.
 *
 * ONE driver session per adapter (= per runner = per vitest worker), created
 * lazily on the first `open()` and reused — WebDriverAgent startup is the
 * expensive part, not the app relaunch. Every `open()` terminates and
 * relaunches the app, so each spec starts from a deterministic fresh state.
 *
 * Webdriverio is an optional peer dependency: it is only imported here, and
 * this module is only loaded when a spec calls `.open()`.
 */
export class AppiumAdapter implements DevicePort {
    /** The verb poll budget — the runner's `timeouts.action`, or the default. */
    private readonly actionTimeoutMs: number;
    private driver: Driver | null = null;
    /** The WebDriverAgent launch budget — the runner's `timeouts.launch`, or the default. */
    private readonly launchTimeoutMs: number;
    private readonly options: { serverUrl: string; udid: string };
    /**
     * The session factory. Absent in production — webdriverio is then loaded
     * lazily on the first `open()`. Injected by this module's own unit test,
     * which drives the waits over a stub driver with no simulator in reach
     * (mocks are CODE here, CONVENTIONS I4).
     */
    private readonly remote?: RemoteFn | undefined;

    constructor(options: {
        remote?: RemoteFn | undefined;
        serverUrl: string;
        timeouts?: DeviceTimeouts | undefined;
        udid: string;
    }) {
        this.options = { serverUrl: options.serverUrl, udid: options.udid };
        this.remote = options.remote;
        this.actionTimeoutMs = options.timeouts?.action ?? DEFAULT_ACTION_TIMEOUT_MS;
        this.launchTimeoutMs = options.timeouts?.launch ?? DEFAULT_WDA_LAUNCH_TIMEOUT_MS;
    }

    async close(): Promise<void> {
        if (this.driver) {
            await this.driver.deleteSession();
            this.driver = null;
        }
    }

    async open(options: DeviceOpenOptions): Promise<DeviceScreen> {
        const driver = await this.session(options.bundleId);

        // Deterministic fresh state: every open terminates the app first,
        // Then relaunches it — plainly, or straight onto the deep link.
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
                // Evidence on failure: a screenshot of the state the
                // Scenario died in, referenced from the error itself.
                const evidence = await this.captureEvidence(driver);
                const suffix = evidence ? `\nEvidence: ${evidence}` : '';
                // A W3 refusal is already a complete, self-explaining
                // Message — re-wrapping it would print the whole thing
                // Twice (once inline, once as the cause).
                if (error instanceof AmbiguousElementError) {
                    error.message += suffix;
                    throw error;
                }
                throw new Error(
                    `open scenario failed: ${error instanceof Error ? error.message : String(error)}${suffix}`,
                    { cause: error },
                );
            }
        }

        return projectScreen(await driver.getPageSource());
    }

    /**
     * The visitor implementation. Acting verbs (tap/fill) poll until exactly
     * one visible match exists (CONVENTIONS W3); `see()` acts on nothing, so
     * ANY visible match satisfies it — XCUITest trees legitimately expose the
     * same text more than once (container/child label duplication), and a
     * synchronization primitive refusing on that would punish honest screens.
     */
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

    /**
     * Resolve a descriptor: poll until at least one visible match exists,
     * then enforce the verb's cardinality — `'one'` refuses ambiguity
     * (CONVENTIONS W3), `'any'` settles for the first match. Scopes stay
     * strict in BOTH modes: "within one of several containers" designates
     * nothing, whatever the verb. The chain resolves outside-in, so an
     * ambiguous scope names ITSELF as the fault rather than sending the
     * author to fix the target.
     */
    private async resolveOne(
        driver: Driver,
        element: MobileElementRef,
        verb: string,
        cardinality: 'any' | 'one',
    ): Promise<DriverElement> {
        const chain = scopeChain(element);
        const deadline = Date.now() + this.actionTimeoutMs;

        /*
         * The scroll-into-view fallback queries the tree WITHOUT the
         * visibility filter — an expensive full snapshot on busy screens —
         * so it runs once, on the first miss, not on every poll.
         */
        let scrollAttempted = false;
        let windowAsked = false;
        let looking = chain;
        for (;;) {
            const resolved = await this.resolveChain(driver, looking, cardinality, {
                tryScroll: !scrollAttempted,
            });
            scrollAttempted = true;
            if (resolved) {
                return resolved;
            }
            if (!windowAsked) {
                // The transitional window, asked on the FIRST miss rather than
                // At the deadline: the deadline is the test's own budget, and
                // A widening that arrives there arrives after the test is over.
                windowAsked = true;
                // oxlint-disable-next-line eslint/no-await-in-loop -- asked ONCE per resolution, and what it answers decides what every later pass looks for
                looking = (await this.widenedChain(driver, chain)) ?? chain;
            }
            if (Date.now() > deadline) {
                throw await this.timeoutError(driver, element, verb);
            }
            await delay(POLL_INTERVAL_MS);
        }
    }

    /** One resolution pass over the chain — `null` means "nothing yet, keep polling". */
    private async resolveChain(
        driver: Driver,
        chain: MobileElementRef[],
        cardinality: 'any' | 'one',
        options?: { tryScroll?: boolean },
    ): Promise<DriverElement | null> {
        let scope: MatchScope = driver;
        for (const [index, level] of chain.entries()) {
            const matches = await matching(scope, level);
            const count = await matches.length;
            if (count === 0) {
                /*
                 * Actionability includes scroll-into-view: an element that
                 * exists below the fold is brought on screen, and the outer
                 * poll re-resolves it as visible on the next pass.
                 */
                if (options?.tryScroll) {
                    const offscreen = await matching(scope, level, { anyVisibility: true });
                    const first = offscreen[0];
                    if (first !== undefined) {
                        try {
                            // Scroll the FOUND element into view directly (by
                            // Id) — a predicate-driven `mobile: scroll` would
                            // Start its own slow native scroll-search instead.
                            await driver.executeScript('mobile: scroll', [
                                { elementId: first.elementId, toVisible: true },
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
                throw new AmbiguousElementError(
                    describeMobileAmbiguity({
                        element: level,
                        matches: await this.captureMatches(matches),
                    }),
                );
            }
            const next = matches[0];
            if (next === undefined) {
                return null;
            }
            scope = next;
        }
        return scope as DriverElement;
    }

    /**
     * The chain to keep polling with, level by level: a descriptor that
     * designated nothing as a whole label but designates exactly one thing as a
     * SUBSTRING is widened, with the warning that names the label to write. The
     * window is the vocabulary's, not one surface's — chapter 13 — so the
     * screen answers it exactly as a page does.
     *
     * `null` when nothing would change, which is the ordinary wait.
     */
    private async widenedChain(
        driver: Driver,
        chain: MobileElementRef[],
    ): Promise<MobileElementRef[] | null> {
        let scope: MatchScope = driver;
        const widened: MobileElementRef[] = [];
        let changed = false;
        /* oxlint-disable eslint/no-await-in-loop -- the chain resolves outside-in: a level can only be looked for inside the scope the level before it resolved to */
        for (const level of chain) {
            const found = await this.widenedLevel(scope, level);
            changed ||= found !== null;
            const candidate = found ?? level;
            const matches = await matching(scope, candidate);
            const next = matches[0];
            if (next === undefined) {
                return null;
            }
            scope = next;
            widened.push(candidate);
        }
        /* oxlint-enable eslint/no-await-in-loop */
        return changed ? widened : null;
    }

    /** One level of the chain, widened and warned about, or `null`. */
    private async widenedLevel(
        scope: MatchScope,
        level: MobileElementRef,
    ): Promise<MobileElementRef | null> {
        if (level.exact !== undefined || level.name === undefined) {
            return null;
        }
        const strict = await matching(scope, level);
        if ((await strict.length) > 0) {
            return null;
        }
        const loose: MobileElementRef = { ...level, exact: false };
        const matches = await matching(scope, loose);
        const first = matches[0];
        // Exactly one, never "at least one": a label several elements carry in
        // Part is the ambiguity the old default hid, and the window may not
        // Resolve it by guessing which one the author meant (W3).
        if (first === undefined || (await matches.length) !== 1) {
            return null;
        }
        const evidence = await captureMatch(first);
        await warnSubstringOnly(level, this.options.udid, evidence.label);
        return loose;
    }

    /** Enumerate the candidates' evidence, truncated. */
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
            const dir = mkdtempSync(resolve(tmpdir(), 'spec-mobile-'));
            const path = resolve(dir, 'failure.png');
            writeFileSync(path, Buffer.from(await driver.takeScreenshot(), 'base64'));
            return path;
        } catch {
            return null;
        }
    }

    /** The timeout refusal, with a compact excerpt of what IS on screen to aid diagnosis. */
    private async timeoutError(
        driver: Driver,
        element: MobileElementRef,
        verb: string,
    ): Promise<Error> {
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
            `${verb}(${formatElement(element)}) timed out after ${this.actionTimeoutMs}ms — no visible match.${excerpt}`,
        );
    }

    /** Create the shared driver session (once), with an actionable error when webdriverio is absent. */
    private async session(bundleId: string): Promise<Driver> {
        if (this.driver) {
            return this.driver;
        }
        const remoteFn = this.remote ?? (await loadRemote());
        const url = new URL(this.options.serverUrl);
        this.driver = await remoteFn({
            capabilities: {
                'appium:automationName': 'XCUITest',
                'appium:bundleId': bundleId,
                'appium:noReset': true,
                'appium:udid': this.options.udid,
                'appium:wdaLaunchTimeout': this.launchTimeoutMs,
                platformName: 'iOS',
            },
            hostname: url.hostname,
            logLevel: 'error',
            port: Number(url.port),
        });
        return this.driver;
    }
}
