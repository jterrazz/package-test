import { describe, expect, test } from 'vitest';

// oxlint-disable-next-line import/no-namespace -- the point of this import IS the export list: the test holds the vocabulary equal to what the module publishes, which a named import cannot read.
import * as elements from '../src/elements/elements.js';
import type { CliResult } from '../src/expectations/command/cli.result.js';
import type { HttpResult } from '../src/facets/api/index.js';
import type { RouteOptionsAny } from '../src/facets/api/request/route.js';
import type { ComponentVisitor, RenderResult } from '../src/facets/component/index.js';
import type { CallResult } from '../src/facets/integration/index.js';
import type { MobileElementKind, MobileVisitor, ScreenResult } from '../src/facets/mobile/index.js';
import type { FetchResult, PageResult, Visitor } from '../src/facets/website/index.js';
import type { JobResult } from '../src/index.js';
import { CAPABILITIES, COLUMNS, memberOf } from './facet-matrix.js';
import type { CapabilityGroup, Column } from './facet-matrix.js';
import { capabilities } from './matrix.js';

/** Each record is pinned to its interface's `keyof` with `satisfies`: a member added or removed fails the build, and the tests below hold the matrix rows equal to the records. */

const FACET_COLUMNS = [
    'api',
    'cli',
    'component',
    'integration',
    'job',
    'mobile',
    'website',
] as const satisfies readonly Exclude<Column, 'module'>[];

type Published = string | true;

/** An XOR option bag keeps its keys. */
type KeysOf<T> = T extends unknown ? keyof T : never;

function published(record: Record<string, Published>): string[] {
    return Object.entries(record)
        .filter(([, value]) => value === true)
        .map(([key]) => key)
        .toSorted();
}

function declared(column: Column, group: CapabilityGroup): string[] {
    return capabilities()
        .filter((capability) => capability.group === group && capability.columns.includes(column))
        .map((capability) => memberOf(capability))
        .toSorted();
}

const INTERNAL = 'an @internal scope the engine uses to resolve `{{type#ref}}` captures';

const NO_DISK = 'inherited from BaseResult; this kind leaves no working directory to read';

const routeOptions = { params: true } satisfies Record<
    KeysOf<NonNullable<RouteOptionsAny>>,
    Published
>;

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

/** Website answers through two results. */
const RESULTS: Record<Exclude<Column, 'module'>, Record<string, Published>[]> = {
    api: [apiResult],
    cli: [cliResult],
    component: [componentResult],
    integration: [integrationResult],
    job: [jobResult],
    mobile: [mobileResult],
    website: [websiteResult, fetchResult],
};

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

/** No kind of its own: the appium adapter translates it. */
const MOBILE_SCOPES = ['within'];

/** `text` is `content()`. */
const MOBILE_DESCRIPTORS: Record<MobileElementKind, string> = {
    button: 'button',
    field: 'field',
    testId: 'testId',
    text: 'content',
};

describe('facet-matrix', () => {
    test('facet capability declaration (K1 guard) — the api declares exactly the options a route action takes', () => {
        // Given - the options `.get()`, `.post()`, `.put()` and `.delete()` take, pinned to their own `keyof`
        // Then - the declaration names the same options
        expect(declared('api', 'Route option')).toStrictEqual(published(routeOptions));
    });

    test('facet capability declaration (K1 guard) — each kind declares exactly the accessors its result publishes', () => {
        // Given - every result class, pinned to its own `keyof`
        // Then - the declaration names the same accessors, per column
        for (const column of FACET_COLUMNS) {
            const names = [
                ...new Set(RESULTS[column].flatMap((result) => published(result))),
            ].toSorted();
            expect(declared(column, 'Result accessor'), `${column} result`).toStrictEqual(names);
        }
    });

    test('facet capability declaration (K1 guard) — each drawing surface declares exactly the verbs its visitor hands out', () => {
        // Given - the three visitors, pinned to their own `keyof`
        // Then - the declaration names the same verbs
        expect(declared('website', 'Verb')).toStrictEqual(published(websiteVisitor));
        expect(declared('mobile', 'Verb')).toStrictEqual(published(mobileVisitor));
        expect(declared('component', 'Verb')).toStrictEqual(published(componentVisitor));
    });

    test('facet capability declaration (K1 guard) — the vocabulary is exactly what `elements/` exports', () => {
        // Given - the element module, which is the vocabulary's one home
        const exported = Object.keys(elements).toSorted();

        // Then - the browsers declare them all, the device the four XCUITest kinds and the scope
        expect(declared('website', 'Descriptor')).toStrictEqual(exported);
        expect(declared('component', 'Descriptor')).toStrictEqual(exported);
        expect(declared('mobile', 'Descriptor')).toStrictEqual(
            [...Object.values(MOBILE_DESCRIPTORS), ...MOBILE_SCOPES].toSorted(),
        );
    });

    test('facet capability declaration (K1 guard) — every declared column is one the matrix has', () => {
        // Given - the declaration, whose columns drive every projection
        // Then - no row names a column the table cannot render
        const unknown = CAPABILITIES.flatMap((capability) =>
            capability.columns.filter((column) => !COLUMNS.includes(column)),
        );
        expect(unknown).toStrictEqual([]);
    });
});
