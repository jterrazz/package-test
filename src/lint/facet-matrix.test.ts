import { describe, expect, test } from 'vitest';

import type { HttpResult } from '../facets/api/api.result.js';
import type { ApiSpecificationOptions } from '../facets/api/api.specification.js';
import type { CliResult } from '../facets/cli/cli.result.js';
import type { CliSpecificationOptions } from '../facets/cli/cli.specification.js';
import type { ComponentProjectOptions } from '../facets/component/component.project.js';
import type { RenderResult } from '../facets/component/component.result.js';
import type { ComponentChain, ComponentVisitor } from '../facets/component/component.types.js';
import type { CallResult } from '../facets/integration/integration.result.js';
import type { IntegrationSpecificationOptions } from '../facets/integration/integration.specification.js';
import type { JobsSpecificationOptions } from '../facets/jobs/jobs.specification.js';
import type { ScreenResult } from '../facets/mobile/mobile.result.js';
import type { MobileSpecificationOptions } from '../facets/mobile/mobile.specification.js';
import type { FetchResult, PageResult } from '../facets/website/website.result.js';
import type { WebsiteSpecificationOptions } from '../facets/website/website.specification.js';
import type {
    ApiSpecification,
    CliSpecification,
    IntegrationSpecification,
    JobsResult,
    JobsSpecification,
    MobileSpecification,
    WebsiteSpecification,
} from '../index.js';
// oxlint-disable-next-line import/no-namespace -- the point of this import IS the export list: the test holds the vocabulary equal to what the module publishes, which a named import cannot read.
import * as elements from '../model/elements/elements.js';
import type { Visitor } from '../model/ports/browser.port.js';
import type { MobileElementKind, MobileVisitor } from '../model/ports/device.port.js';
import { CAPABILITIES, COLUMNS, memberOf, methodsByRole } from './facet-matrix.js';
import type { CapabilityGroup, Column, FacetRole } from './facet-matrix.js';

/**
 * Meta-test (K1 guard) — the capability declaration IS the facet surfaces.
 *
 * The matrix, the eight signature cards and chapter 03's table are all one
 * projection of `CAPABILITIES`, and an agent writes tests from the card. So a
 * row that names a member no interface has publishes a method that does not
 * exist (`result.json` on an api result once did), and a member with no row
 * hides one that does (`.clock()` and `.headers()` on website did).
 *
 * Every record below re-encodes what one interface publishes and is pinned to
 * its real `keyof` with `satisfies`, which forces exhaustiveness in BOTH
 * directions on the object literal:
 *   - add a member to a facet interface → the record is MISSING a key      → the build fails;
 *   - remove or rename one              → the record has an EXTRANEOUS key → the build fails.
 * A key's value is `true` when the matrix publishes it as a row, and the
 * SENTENCE saying why not when it does not. The runtime tests then hold the
 * declaration equal to the union of those records, column by column — so the
 * compiler catches a surface change and the suite catches a matrix that did
 * not follow it.
 *
 * Types are erased at runtime, which is exactly why both halves are needed.
 */

/** The seven columns that are a facet — every column but the module test. */
const FACET_COLUMNS = [
    'api',
    'cli',
    'component',
    'integration',
    'jobs',
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

/** What the declaration says a column publishes, for one group. */
function declared(column: Column, group: CapabilityGroup): string[] {
    return CAPABILITIES.filter(
        (capability) => capability.group === group && capability.columns.includes(column),
    )
        .map((capability) => memberOf(capability))
        .toSorted();
}

/** Not a row of the matrix: the ref-capture scope every result carries for the engine. */
const INTERNAL = 'an @internal scope the engine uses to resolve `{{type#ref}}` captures';

/** Not a row on a surface that leaves no working directory behind. */
const NO_DISK = 'inherited from BaseResult; this kind leaves no working directory to read';

// ── The chains: which method is a setup, which is the one terminal action ──

const apiChain = {
    clock: 'setup',
    headers: 'setup',
    intercept: 'setup',
    seed: 'setup',

    delete: 'action',
    get: 'action',
    post: 'action',
    put: 'action',
    request: 'action',
} satisfies Record<keyof ApiSpecification, FacetRole>;

const jobsChain = {
    clock: 'setup',
    intercept: 'setup',
    seed: 'setup',

    trigger: 'action',
} satisfies Record<keyof JobsSpecification, FacetRole>;

const integrationChain = {
    clock: 'setup',
    intercept: 'setup',
    seed: 'setup',

    call: 'action',
} satisfies Record<keyof IntegrationSpecification, FacetRole>;

const cliChain = {
    env: 'setup',
    fixture: 'setup',
    seed: 'setup',

    exec: 'action',
    run: 'action',
} satisfies Record<keyof CliSpecification, FacetRole>;

const websiteChain = {
    clock: 'setup',
    headers: 'setup',
    intercept: 'setup',

    fetch: 'action',
    visit: 'action',
} satisfies Record<keyof WebsiteSpecification, FacetRole>;

const mobileChain = {
    intercept: 'setup',

    open: 'action',
} satisfies Record<keyof MobileSpecification, FacetRole>;

const componentChain = {
    clock: 'setup',
    intercept: 'setup',
    viewport: 'setup',
    wrap: 'setup',

    render: 'action',
} satisfies Record<keyof ComponentChain, FacetRole>;

const CHAINS: Record<Exclude<Column, 'module'>, Record<string, FacetRole>> = {
    api: apiChain,
    cli: cliChain,
    component: componentChain,
    integration: integrationChain,
    jobs: jobsChain,
    mobile: mobileChain,
    website: websiteChain,
};

// ── The constructor options (component's are the PROJECT's) ──

const apiOptions = {
    root: true,
    server: true,
    services: true,
} satisfies Record<KeysOf<ApiSpecificationOptions>, Published>;

const jobsOptions = {
    jobs: true,
    root: true,
    services: true,
} satisfies Record<KeysOf<JobsSpecificationOptions>, Published>;

const cliOptions = {
    defaults: true,
    docker: true,
    env: true,
    root: true,
    serve: true,
    services: true,
    transform: true,
} satisfies Record<KeysOf<CliSpecificationOptions>, Published>;

const integrationOptions = {
    root: true,
    services: true,
} satisfies Record<KeysOf<IntegrationSpecificationOptions>, Published>;

const websiteOptions = {
    backend: true,
    external: true,
    root: true,
    server: true,
    services: true,
    transform: true,
    url: true,
} satisfies Record<KeysOf<WebsiteSpecificationOptions>, Published>;

const mobileOptions = {
    app: true,
    backend: true,
    device: true,
    root: true,
    services: true,
    timeouts: true,
} satisfies Record<KeysOf<MobileSpecificationOptions>, Published>;

/** A knob every facet project takes, not a capability of one kind. */
const PROJECT_KNOB =
    'a `FacetProjectOptions` knob every facet project takes — [02 § vitest.config] owns them';

const componentOptions = {
    clock: true,
    exclude: PROJECT_KNOB,
    include: PROJECT_KNOB,
    serial: PROJECT_KNOB,
    timeout: PROJECT_KNOB,
    locale: true,
    root: true,
    timezone: true,
    viewport: true,
    vite: true,
    wrap: true,
} satisfies Record<KeysOf<ComponentProjectOptions>, Published>;

const OPTIONS: Record<Exclude<Column, 'module'>, Record<string, Published>> = {
    api: apiOptions,
    cli: cliOptions,
    component: componentOptions,
    integration: integrationOptions,
    jobs: jobsOptions,
    mobile: mobileOptions,
    website: websiteOptions,
};

// ── The results: what a terminal action hands back ──

const apiResult = {
    captures: INTERNAL,
    directory: true,
    file: true,
    response: true,
    status: true,
    table: true,
} satisfies Record<keyof HttpResult, Published>;

const jobsResult = {
    captures: INTERNAL,
    table: true,
} satisfies Record<keyof JobsResult, Published>;

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
    jobs: [jobsResult],
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

/** The mobile element kinds, as the vocabulary spells them (`text` is `content()`). */
const MOBILE_DESCRIPTORS: Record<MobileElementKind, string> = {
    button: 'button',
    field: 'field',
    testId: 'testId',
    text: 'content',
};

describe('facet capability declaration (K1 guard)', () => {
    test('each chain declares exactly the setups and terminal actions it has', () => {
        // Given - every chain, pinned to its own `keyof`
        // Then - the declaration names the same members, per column
        for (const column of FACET_COLUMNS) {
            const chain = CHAINS[column];
            expect(declared(column, 'Setup'), `${column} setups`).toStrictEqual(
                methodsByRole(chain, 'setup'),
            );
            expect(declared(column, 'Terminal action'), `${column} actions`).toStrictEqual(
                methodsByRole(chain, 'action'),
            );
        }
    });

    test('each kind declares exactly the options its constructor takes', () => {
        // Given - every options bag, pinned to its own `keyof`
        // Then - the declaration names the same options, per column
        for (const column of FACET_COLUMNS) {
            expect(declared(column, 'Constructor option'), `${column} options`).toStrictEqual(
                published(OPTIONS[column]),
            );
        }
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

        // Then - the browsers declare them all, the device the four XCUITest kinds
        expect(declared('website', 'Descriptor')).toStrictEqual(exported);
        expect(declared('component', 'Descriptor')).toStrictEqual(exported);
        expect(declared('mobile', 'Descriptor')).toStrictEqual(
            Object.values(MOBILE_DESCRIPTORS).toSorted(),
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
