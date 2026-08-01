import type { ElementRef } from './browser.port.js';

/**
 * The element kinds a mobile screen can designate — the structural subset of
 * {@link ElementRef} kinds that map onto the XCUITest accessibility tree.
 * There is ONE element vocabulary across facets: `button('Bookmark')` works
 * in a visit scenario and a mobile scenario alike. Landmarks have no iOS
 * analog — passing one to a mobile verb refuses at runtime.
 */
export type MobileElementKind = 'button' | 'field' | 'testId' | 'text';

/**
 * A user-facing element descriptor for mobile scenarios — pure data, built by
 * the shared element vocabulary (`button()`, `field()`, `content()`,
 * `testId()`, `within()`) and translated into iOS predicate strings by the
 * device integration. Structurally the same ref type as the browser's, so the
 * vocabulary stays single; kinds outside {@link MobileElementKind} (the ARIA
 * landmarks) are refused at runtime with a message naming the boundary.
 *
 * A descriptor must designate exactly ONE element at action time; see
 * {@link MobileElementMatch} and CONVENTIONS W3.
 */
export type MobileElementRef = ElementRef;

/**
 * One candidate captured when a descriptor matched more than one element —
 * the evidence the ambiguity error enumerates so the author can disambiguate
 * without opening the simulator.
 */
export interface MobileElementMatch {
    /** The accessibility identifier (`testId()` target), when one is set. */
    identifier?: string;
    /** The accessible label, whitespace-collapsed and truncated. */
    label?: string;
    /** Element type without the `XCUIElementType` prefix — `Button`, `StaticText`. */
    type: string;
    /** The element value (text-field content, adjustable value), when present. */
    value?: string;
}

/**
 * The visitor — the interaction vocabulary handed to a mobile scenario.
 * Every verb auto-waits by polling until at least one visible match exists;
 * `see()` is the single synchronization primitive: it retries until the
 * element is visible and fails at the timeout. There is no sleep and no
 * conditional helper.
 */
export interface MobileVisitor {
    /** Fill a text field with a value. */
    fill: (element: MobileElementRef, value: string) => Promise<void>;
    /** Wait until the element is visible — the only synchronization primitive. */
    see: (element: MobileElementRef) => Promise<void>;
    /** Tap the element. */
    tap: (element: MobileElementRef) => Promise<void>;
}

/** The behavior of an open — the When of the spec; assertions stay in the Then. */
export type MobileScenario = (visitor: MobileVisitor) => Promise<void>;

/**
 * One node of the projected accessibility tree — the XCUITest page source
 * with its noise collapsed: unlabeled, identifier-less, valueless wrapper
 * nodes are dropped and their children hoisted, so the projection stays
 * stable and golden-friendly. Type names lose the `XCUIElementType` prefix.
 */
export interface ScreenNode {
    children?: ScreenNode[];
    /** The accessibility identifier, only when it differs from the label. */
    identifier?: string;
    label?: string;
    /** Element type without the `XCUIElementType` prefix — `Button`, `StaticText`. */
    type: string;
    value?: string;
}

/**
 * The screen captured by a device open — the FINAL state when a scenario
 * ran. The tree is the projected page source; `texts` are the visible
 * labels/values in document order, consecutive duplicates collapsed.
 */
export interface DeviceScreen {
    texts: string[];
    tree: ScreenNode;
}

/** Per-open options forwarded to the device session. */
export interface DeviceOpenOptions {
    /** The app under test — terminated and relaunched for a fresh, deterministic state. */
    bundleId: string;
    /** Deep link applied after the relaunch (`news://events`); absent opens the app plainly. */
    deepLink?: string;
    /** The interaction scenario to run after launch; the capture reflects the final state. */
    scenario?: MobileScenario;
}

/**
 * Abstract device interface for the mobile specification runner.
 * One implementation lives in `integrations/appium/` — a single driver
 * session per runner, created on the first `open()` and reused; each open
 * terminates and relaunches the app for a deterministic fresh state.
 */
export interface DevicePort {
    /** End the driver session (idempotent). */
    close: () => Promise<void>;
    /** Relaunch the app, apply the deep link, run the scenario, capture the final screen. */
    open: (options: DeviceOpenOptions) => Promise<DeviceScreen>;
}
