import { describe, expect, test } from 'vitest';

import type { CliResult } from '../../../../src/expectations/command/cli.result.js';
import type { JobResult, LintResult } from '../../../../src/index.js';
import type { HttpResult } from '../../../../src/specifications/api/api.face.js';
import type { RouteOptionsAny } from '../../../../src/specifications/api/request/route.js';
import type {
    ComponentVisitor,
    RenderResult,
} from '../../../../src/specifications/component/component.face.js';
import type { CallResult } from '../../../../src/specifications/integration/integration.face.js';
import type { MobileElementKind } from '../../../../src/specifications/mobile/device/device.port.js';
import type {
    MobileVisitor,
    ScreenResult,
} from '../../../../src/specifications/mobile/mobile.face.js';
import type {
    FetchResult,
    PageResult,
    WebsiteVisitor,
} from '../../../../src/specifications/website/website.face.js';
/* oxlint-disable import/no-namespace -- the point of these imports IS the export list: the test holds the vocabulary equal to what the target modules publish, which a named import cannot read. */
import * as landmarks from '../../../../src/visitor/targets/landmarks.js';
import * as modifiers from '../../../../src/visitor/targets/modifiers.js';
import * as roles from '../../../../src/visitor/targets/roles.js';
import { matrixCapabilities } from '../matrix.js';
/* oxlint-enable import/no-namespace */
import {
    SPECIFICATION_MATRIX_CAPABILITIES,
    SPECIFICATION_MATRIX_COLUMNS,
    specificationMatrixMember,
} from '../specification-matrix.js';
import type { CapabilityGroup, Column } from '../specification-matrix.js';

// invariant: each record is pinned to its interface's `keyof` with `satisfies`: a member added or removed fails the build, and the tests below hold the matrix rows equal to the records.

const SPECIFICATION_COLUMNS = [
    'api',
    'cli',
    'component',
    'integration',
    'job',
    'lint',
    'mobile',
    'website',
] as const satisfies readonly Exclude<Column, 'module'>[];

type Published = string | true;

type KeysOf<T> = T extends unknown ? keyof T : never;

function published(record: Record<string, Published>): string[] {
    return Object.entries(record)
        .filter(([, value]) => value === true)
        .map(([key]) => key)
        .toSorted();
}

function declared(column: Column, group: CapabilityGroup): string[] {
    return matrixCapabilities()
        .filter((capability) => capability.group === group && capability.columns.includes(column))
        .map((capability) => specificationMatrixMember(capability))
        .toSorted();
}

const INTERNAL = 'an @internal scope the matcher uses to resolve `{{type#ref}}` captures';

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
    requests: true,
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

const lintResult = {
    captures: INTERNAL,
    directory: true,
    file: true,
    report: true,
    table: 'inherited from BaseResult; a lint starts no database to read',
} satisfies Record<keyof LintResult, Published>;

const componentResult = {
    console: true,
    content: true,
    errors: true,
    html: true,
    tree: true,
    visibleContent: true,
} satisfies Record<keyof RenderResult, Published>;

const RESULTS: Record<Exclude<Column, 'module'>, Record<string, Published>[]> = {
    api: [apiResult],
    cli: [cliResult],
    component: [componentResult],
    integration: [integrationResult],
    job: [jobResult],
    lint: [lintResult],
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
} satisfies Record<keyof WebsiteVisitor, Published>;

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

// invariant: no kind of its own: the appium adapter translates it.
const MOBILE_SCOPES = ['within'];

const MOBILE_TARGETS: Record<MobileElementKind, string> = {
    button: 'button',
    field: 'field',
    testId: 'testId',
    text: 'content',
};

describe('specification-matrix', () => {
    test('specification capability declaration (`discovery-grows-a-guard` guard) — the api declares exactly the options a route action takes', () => {
        // Given - the options `.get()`, `.post()`, `.put()` and `.delete()` take, pinned to their own `keyof`
        // Then - the declaration names the same options
        expect(declared('api', 'Route option')).toStrictEqual(published(routeOptions));
    });

    test('specification capability declaration (`discovery-grows-a-guard` guard) — each kind declares exactly the accessors its result publishes', () => {
        // Given - every result class, pinned to its own `keyof`
        // Then - the declaration names the same accessors, per column
        expect(
            SPECIFICATION_COLUMNS.map((column) => declared(column, 'Result accessor')),
        ).toStrictEqual(
            SPECIFICATION_COLUMNS.map((column) =>
                [...new Set(RESULTS[column].flatMap((result) => published(result)))].toSorted(),
            ),
        );
    });

    test('specification capability declaration (`discovery-grows-a-guard` guard) — each drawing surface declares exactly the verbs its visitor hands out', () => {
        // Given - the three visitors, pinned to their own `keyof`
        // Then - the declaration names the same verbs
        expect(declared('website', 'Verb')).toStrictEqual(published(websiteVisitor));
        expect(declared('mobile', 'Verb')).toStrictEqual(published(mobileVisitor));
        expect(declared('component', 'Verb')).toStrictEqual(published(componentVisitor));
    });

    test('specification capability declaration (`discovery-grows-a-guard` guard) — the vocabulary is exactly what `visitor/targets/` exports, but the scope walk the adapters share and the factory the landmarks build with', () => {
        // Given - the target modules, which are the vocabulary's one home
        const exported = [roles, landmarks, modifiers]
            .flatMap((module) => Object.keys(module))
            .filter(
                (name) => ![landmarks.scopeChain.name, roles.optionallyNamed.name].includes(name),
            )
            .toSorted();

        // Then - the browsers declare them all, the device the four XCUITest kinds and the scope
        expect(declared('website', 'Target')).toStrictEqual(exported);
        expect(declared('component', 'Target')).toStrictEqual(exported);
        expect(declared('mobile', 'Target')).toStrictEqual(
            [...Object.values(MOBILE_TARGETS), ...MOBILE_SCOPES].toSorted(),
        );
    });

    test('specification capability declaration (`discovery-grows-a-guard` guard) — every declared column is one the matrix has', () => {
        // Given - the declaration, whose columns drive every projection
        // Then - no row names a column the table cannot render
        const unknown = SPECIFICATION_MATRIX_CAPABILITIES.flatMap((capability) =>
            capability.columns.filter((column) => !SPECIFICATION_MATRIX_COLUMNS.includes(column)),
        );
        expect(unknown).toStrictEqual([]);
    });
});
