import { describe, expect, test } from 'vitest';

import type { ComponentVisitor } from '../src/actions/render/scenario.js';
import type { RouteOptionsAny } from '../src/capabilities/params/route.js';
import type { JobResult } from '../src/index.js';
// oxlint-disable-next-line import/no-namespace -- the point of this import IS the export list: the test holds the vocabulary equal to what the module publishes, which a named import cannot read.
import * as elements from '../src/model/elements/elements.js';
import type { Visitor } from '../src/model/ports/browser.port.js';
import type { MobileElementKind, MobileVisitor } from '../src/model/ports/device.port.js';
import type { CallResult } from '../src/results/call.result.js';
import type { CliResult } from '../src/results/cli.result.js';
import type { FetchResult } from '../src/results/fetch.result.js';
import type { HttpResult } from '../src/results/http.result.js';
import type { PageResult } from '../src/results/page.result.js';
import type { RenderResult } from '../src/results/render.result.js';
import type { ScreenResult } from '../src/results/screen.result.js';
import { CAPABILITIES, COLUMNS, memberOf } from './facet-matrix.js';
import type { CapabilityGroup, Column } from './facet-matrix.js';
import { capabilities } from './matrix.js';

/**
 * Meta-test (K1 guard) — the rows of the capability matrix ARE the surfaces.
 *
 * A reader writes tests from chapter 03's table. So a row that names a member
 * no interface has publishes a method that does not exist (`result.json` on
 * an api result once did), and a member with no row hides one that does
 * (`.clock()` and `.headers()` on website did).
 *
 * A composition pins most of its rows itself: `defineFacet` refuses a
 * composition naming other members than its chain, its options are pinned to
 * the constructor's `keyof` where they are composed, and every definition
 * states the row of its own member (`self/compositions.test.ts`). What a
 * composition cannot pin is what an action states about something else — the
 * result it hands back, the visitor it hands a scenario, the element
 * vocabulary, the options a route takes — so every record below re-encodes
 * one of those interfaces and is pinned to its real `keyof` with `satisfies`,
 * which forces exhaustiveness in BOTH directions on the object literal:
 *   - add a member to the interface → the record is MISSING a key      → the build fails;
 *   - remove or rename one          → the record has an EXTRANEOUS key → the build fails.
 * A key's value is `true` when the matrix publishes it as a row, and the
 * SENTENCE saying why not when it does not. The runtime tests then hold the
 * rows equal to those records, column by column — so the compiler catches a
 * surface change and the suite catches rows that did not follow it.
 */

/** The seven columns that are a facet — every column but the module test. */
const FACET_COLUMNS = [
    'api',
    'cli',
    'component',
    'integration',
    'job',
    'mobile',
    'website',
] as const satisfies readonly Exclude<Column, 'module'>[];

/** A member the matrix publishes, or the reason it does not. */
type Published = string | true;

/** Every key of a union type, branch by branch — an XOR option bag keeps its keys. */
type KeysOf<T> = T extends unknown ? keyof T : never;

/** The keys of a record whose value says "published". */
function published(record: Record<string, Published>): string[] {
    return Object.entries(record)
        .filter(([, value]) => value === true)
        .map(([key]) => key)
        .toSorted();
}

/** What the matrix says a column publishes, for one group. */
function declared(column: Column, group: CapabilityGroup): string[] {
    return capabilities()
        .filter((capability) => capability.group === group && capability.columns.includes(column))
        .map((capability) => memberOf(capability))
        .toSorted();
}

/** Not a row of the matrix: the ref-capture scope every result carries for the engine. */
const INTERNAL = 'an @internal scope the engine uses to resolve `{{type#ref}}` captures';

/** Not a row on a surface that leaves no working directory behind. */
const NO_DISK = 'inherited from BaseResult; this kind leaves no working directory to read';

/** What an api action is handed beside its route's template. */
const routeOptions = { params: true } satisfies Record<
    KeysOf<NonNullable<RouteOptionsAny>>,
    Published
>;

// ── The results: what a terminal action hands back ──

const apiResult = {
    captures: INTERNAL,
    directory: true,
    file: true,
    response: true,
    status: true,
    table: true,
} satisfies Record<keyof HttpResult, Published>;

const jobResult = {
    captures: INTERNAL,
    table: true,
} satisfies Record<keyof JobResult, Published>;

const cliResult = {
    [Symbol.asyncDispose]: 'the leak-free teardown a `await using` result runs, not an accessor',
    captures: INTERNAL,
    container: true,
    containerIds: true,
    directory: true,
    exitCode: true,
    file: true,
    filesystem: true,
    json: true,
    stderr: true,
    stdout: true,
    table: true,
} satisfies Record<keyof CliResult, Published>;

const integrationResult = {
    captures: INTERNAL,
    directory: true,
    error: true,
    file: true,
    table: true,
    value: true,
} satisfies Record<keyof CallResult, Published>;

const websiteResult = {
    alternates: true,
    canonical: true,
    captures: INTERNAL,
    console: true,
    content: true,
    directory: NO_DISK,
    errors: true,
    file: NO_DISK,
    head: true,
    html: true,
    jsonLd: true,
    links: true,
    meta: true,
    status: true,
    table: NO_DISK,
    title: true,
    tree: true,
    url: true,
} satisfies Record<keyof PageResult, Published>;

const fetchResult = {
    body: true,
    captures: INTERNAL,
    directory: NO_DISK,
    file: NO_DISK,
    headers: true,
    json: true,
    location: true,
    status: true,
    table: NO_DISK,
} satisfies Record<keyof FetchResult, Published>;

const mobileResult = {
    captures: INTERNAL,
    content: true,
    directory: NO_DISK,
    file: NO_DISK,
    screen: true,
    table: NO_DISK,
} satisfies Record<keyof ScreenResult, Published>;

const componentResult = {
    console: true,
    content: true,
    errors: true,
    html: true,
    tree: true,
} satisfies Record<keyof RenderResult, Published>;

/** A column's result surface — website answers through two results, so both. */
const RESULTS: Record<Exclude<Column, 'module'>, Record<string, Published>[]> = {
    api: [apiResult],
    cli: [cliResult],
    component: [componentResult],
    integration: [integrationResult],
    job: [jobResult],
    mobile: [mobileResult],
    website: [websiteResult, fetchResult],
};

// ── The visitors: the verbs a scenario drives ──

const websiteVisitor = {
    check: true,
    click: true,
    fill: true,
    gone: true,
    goto: true,
    hover: true,
    press: true,
    see: true,
    select: true,
} satisfies Record<keyof Visitor, Published>;

const mobileVisitor = {
    fill: true,
    see: true,
    tap: true,
} satisfies Record<keyof MobileVisitor, Published>;

const componentVisitor = {
    check: true,
    click: true,
    fill: true,
    gone: true,
    hover: true,
    press: true,
    rerender: true,
    see: true,
    select: true,
    unmount: true,
} satisfies Record<keyof ComponentVisitor, Published>;

/** What scopes a descriptor on a device rather than naming an element: no kind of its own, translated by the appium adapter — `appium.adapter.test.ts` taps through one. */
const MOBILE_SCOPES = ['within'];

/** The mobile element kinds, as the vocabulary spells them (`text` is `content()`). */
const MOBILE_DESCRIPTORS: Record<MobileElementKind, string> = {
    button: 'button',
    field: 'field',
    testId: 'testId',
    text: 'content',
};

describe('facet capability declaration (K1 guard)', () => {
    test('the api declares exactly the options a route action takes', () => {
        // Given - the options `.get()`, `.post()`, `.put()` and `.delete()` take, pinned to their own `keyof`
        // Then - the declaration names the same options
        expect(declared('api', 'Route option')).toStrictEqual(published(routeOptions));
    });

    test('each kind declares exactly the accessors its result publishes', () => {
        // Given - every result class, pinned to its own `keyof`
        // Then - the declaration names the same accessors, per column
        for (const column of FACET_COLUMNS) {
            const names = [
                ...new Set(RESULTS[column].flatMap((result) => published(result))),
            ].toSorted();
            expect(declared(column, 'Result accessor'), `${column} result`).toStrictEqual(names);
        }
    });

    test('each drawing surface declares exactly the verbs its visitor hands out', () => {
        // Given - the three visitors, pinned to their own `keyof`
        // Then - the declaration names the same verbs
        expect(declared('website', 'Verb')).toStrictEqual(published(websiteVisitor));
        expect(declared('mobile', 'Verb')).toStrictEqual(published(mobileVisitor));
        expect(declared('component', 'Verb')).toStrictEqual(published(componentVisitor));
    });

    test('the vocabulary is exactly what `model/elements/` exports', () => {
        // Given - the element module, which is the vocabulary's one home
        const exported = Object.keys(elements).toSorted();

        // Then - the browsers declare them all, the device the four XCUITest kinds and the scope
        expect(declared('website', 'Descriptor')).toStrictEqual(exported);
        expect(declared('component', 'Descriptor')).toStrictEqual(exported);
        expect(declared('mobile', 'Descriptor')).toStrictEqual(
            [...Object.values(MOBILE_DESCRIPTORS), ...MOBILE_SCOPES].toSorted(),
        );
    });

    test('every declared column is one the matrix has', () => {
        // Given - the declaration, whose columns drive every projection
        // Then - no row names a column the table cannot render
        const unknown = CAPABILITIES.flatMap((capability) =>
            capability.columns.filter((column) => !COLUMNS.includes(column)),
        );
        expect(unknown).toStrictEqual([]);
    });
});
