import type { PageVerbs } from '../../../elements/verbs.js';

export type MobileDevice = {
    /** Simulator name, matched exactly (`iPhone 17`). */
    name: string;
    /** OS narrowing when the name exists on several runtimes — `'26.5'` or `'iOS 26.5'`. */
    os?: string;
    /** Explicit UDID — skips name/os resolution entirely. */
    udid?: string;
};

/** The element kinds a mobile screen designates, each compiled to an iOS predicate; every other kind is refused. */
export type MobileElementKind = 'button' | 'field' | 'testId' | 'text';

/** One candidate of an ambiguous descriptor, as the refusal lists it. */
export type MobileElementMatch = {
    /** The accessibility identifier (`testId()` target), when one is set. */
    identifier?: string;
    /** The accessible label, whitespace-collapsed and truncated. */
    label?: string;
    /** Element type without the `XCUIElementType` prefix — `Button`, `StaticText`. */
    type: string;
    /** The element value (text-field content, adjustable value), when present. */
    value?: string;
};

/** The verbs a mobile scenario is handed: a page's `see` and `fill`, and a `tap`; each polls until a visible match exists. */
export type MobileVisitor = Pick<PageVerbs, 'fill' | 'see'> & {
    tap: PageVerbs['click'];
};

/** The behavior of an open — the When of the spec; assertions stay in the Then. */
export type MobileScenario = (visitor: MobileVisitor) => Promise<void>;

/** One node of the projected accessibility tree: noise wrappers dropped, `XCUIElementType` prefix removed. */
export type ScreenNode = {
    children?: ScreenNode[];
    /** The accessibility identifier, only when it differs from the label. */
    identifier?: string;
    label?: string;
    /** Element type without the `XCUIElementType` prefix — `Button`, `StaticText`. */
    type: string;
    value?: string;
};

/** The screen captured by an open, final state: the projected tree and the visible texts. */
export type DeviceScreen = {
    texts: string[];
    tree: ScreenNode;
};

/** Per-open options forwarded to the device session. */
export type DeviceOpenOptions = {
    /** The app under test — terminated and relaunched for a fresh, deterministic state. */
    bundleId: string;
    /** Deep link applied after the relaunch (`news://events`); absent opens the app plainly. */
    deepLink?: string | undefined;
    /** The interaction scenario to run after launch; the capture reflects the final state. */
    scenario?: MobileScenario | undefined;
};

/** How long a device session waits, in milliseconds; each field falls back to the default. */
export type DeviceTimeouts = {
    /** How long every verb polls for a visible match. Default `30_000`. */
    action?: number | undefined;
    /** How long the first session waits for WebDriverAgent to build and launch. Default `240_000`. */
    launch?: number | undefined;
};

/** The device a mobile runner drives: one driver session, each open relaunching the app. */
export type DevicePort = {
    /** End the driver session, unless it is the run's (idempotent). */
    close: () => Promise<void>;
    /** Relaunch the app, apply the deep link, run the scenario, capture the final screen. */
    open: (options: DeviceOpenOptions) => Promise<DeviceScreen>;
};
