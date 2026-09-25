/**
 * The browser-safe half of the public surface — everything `@jterrazz/test`
 * exports that a PAGE can load.
 *
 * The package has one specifier and two runtimes. `src/index.ts` is the node
 * composition root: it wires the container seams and adds the facets, services
 * and results that read a disk, spawn a process or open a socket.
 * `src/browser/index.ts` is the page's, and it re-exports this module verbatim,
 * replacing each of those node-only names with a stub that says where it runs.
 * What both entries agree on lives HERE, once, so the two surfaces can only
 * differ where a runtime genuinely forces them to.
 *
 * The vitest matcher augmentation is part of that agreement, so it sits here
 * too: one `declare module` for one published `types` entry.
 */

import type {
    DiskDirectory as DiskDirectoryType,
    DiskFile as DiskFileType,
} from './model/chain/spec-path.js';
import type {
    MatchFixtureOptions as MatchFixtureOptionsType,
    TableMatchOptions as TableMatchOptionsType,
} from './model/goldens/match-options.js';
import type { ContainerAccessor as ContainerAccessorType } from './results/container.js';
import type { DirectoryAccessor as DirectoryAccessorType } from './results/directory.js';
import type { FilesystemAccessor as FilesystemAccessorType } from './results/filesystem.js';
import type { JsonAccessor as JsonAccessorType } from './results/json.js';
import type { ResponseAccessor as ResponseAccessorType } from './results/response.js';
import type { TableAccessor as TableAccessorType } from './results/table.js';
import type { TextAccessor as TextAccessorType } from './results/text.js';

// The component facet — the chain lives in whichever build can run it (the
// Page's), and the SHAPE is stated once so both entries publish the same one.
export type {
    ComponentScenario,
    ComponentVisitor,
    RenderSubject,
} from './actions/render/scenario.js';
export type { ComponentChain } from './facets/component/component.facet.js';
export type { RenderResult } from './results/render.result.js';
export type { RenderedText } from './results/rendered-text.js';
export type { ComponentUi, DomMount } from './seams/vitest-browser/ui.js';

// Match — dynamic values in assertions and fixtures
export { type CaptureScope, match, Matcher, type MatcherKind } from './model/matching/match.js';

// Accessors a page can build: pure projections over a captured value. TYPES,
// Like every other accessor — `text()` is the one that HANDS one out.
export type { JsonAccessor } from './results/json.js';
export type { TableAccessor } from './results/table.js';
export type { TextAccessor } from './results/text.js';

// Ports — the shapes the element vocabulary and the visitors speak
export type {
    BrowserConsoleMessage,
    BrowserLinkElement,
    BrowserMetaElement,
    BrowserOpenOptions,
    BrowserPage,
    BrowserPort,
    ElementKind,
    ElementMatch,
    ElementRef,
    LandmarkKind,
    Visitor,
    VisitScenario,
} from './model/ports/browser.port.js';
export type {
    DeviceOpenOptions,
    DevicePort,
    DeviceScreen,
    DeviceTimeouts,
    MobileElementKind,
    MobileElementMatch,
    MobileElementRef,
    MobileScenario,
    MobileVisitor,
    ScreenNode,
} from './model/ports/device.port.js';

// The element vocabulary — user-facing descriptors, shared by visit (website),
// Render (component) and open (mobile) scenarios: ONE vocabulary, three facets.
// Landmarks are website/component-only and refuse at runtime on a mobile verb.
export {
    banner,
    button,
    complementary,
    content,
    contentinfo,
    dialog,
    disabled,
    type ElementOptions,
    enabled,
    field,
    focused,
    form,
    heading,
    link,
    listitem,
    main,
    navigation,
    option,
    region,
    row,
    search,
    selected,
    status,
    table,
    testId,
    valued,
    within,
} from './model/elements/elements.js';

// Stubs — the ONE way to declare what the outside world replies
export { anthropic } from './stubs/anthropic/anthropic.js';
export {
    http,
    type HttpResponseInit,
    type HttpStreamInit,
    type HttpStubFilter,
    type SseEvent,
} from './stubs/http/http.js';
export { type TextFilter } from './stubs/filters.js';
export { openai } from './stubs/openai/openai.js';
export { defineStub, defineStubs, type Stub, type StubInput, type Stubs } from './stubs/stub.js';
export type {
    MatchableRequest,
    StreamBody,
    StubRequest,
    StubResponder,
    StubResponse,
    StubResponseValue,
} from './stubs/exchange.js';
// The module-scope double — the VALUE is each entry's (one engine per runtime);
// The shape is stated here so the two surfaces can only publish the same one.
export type {
    Intercept,
    InterceptOptions,
    InterceptScope,
} from './capabilities/intercept/intercept.scope.js';

// Mock
export { mockOf, type MockOfOptions, type MockPort } from './model/doubles/mock-of.js';

// Time — the one primitive, real in both runtimes
export { clock, type PinnedClock } from './model/clock/clock.js';

// Assertions that are not matchers: a value that must be there, and a
// Condition that has to become true.
export { required } from './model/assertions/required.js';
export { waitUntil, type WaitUntilOptions } from './model/assertions/wait-until.js';

// The disk: a string is a value, and what a test stands on is named by one of
// These two — the only argument a verb that reads the disk accepts
export {
    directory,
    type DiskDirectory,
    type DiskFile,
    type DiskTarget,
    file,
    type FileAt,
    type RelativePath,
} from './model/chain/spec-path.js';

// A linter's report as a golden keeps it — the transform a rule's specs share
export { lintReport } from './model/goldens/lint-report.js';

// Matcher options (per-call `toMatch(file(…), { frozen })`)
export type { MatchFixtureOptions } from './model/goldens/match-options.js';

/** A table's rows as a test writes them in place: one array of cells per row, every column — or `''`, nothing recorded yet. */
type TableRows = readonly (readonly unknown[])[];

/**
 * What a json is compared to in place: a JSON value — tokens in its strings,
 * `match.*` in its leaves — or its golden. A RegExp is none of them.
 */
type JsonExpectation =
    | boolean
    | DiskFileType
    | null
    | number
    | Readonly<Record<string, unknown>>
    | readonly unknown[]
    | string;

/**
 * The whole-result half of `toMatch`, by subject: the value written in place,
 * or the golden a `file()`/`directory()` names. A stream and a response take
 * their text (a response's is its `.http` text), a json its value, a table its
 * rows (async: the table is queried), a working directory or one of its
 * directories its `directory()` golden (async: the tree is compared on disk).
 * A text captured INSIDE a page is awaited: its golden crosses the browser
 * seam, and so does the rewrite update mode makes. Any other subject has no
 * whole-result half, and `toMatch` is vitest's alone.
 */
type WholeMatch<T, R> = T extends { readonly capturedInPage: true }
    ? (expected: DiskFileType | string, options?: MatchFixtureOptionsType) => Promise<void>
    : T extends TextAccessorType
      ? (expected: DiskFileType | string, options?: MatchFixtureOptionsType) => R
      : T extends ResponseAccessorType
        ? (expected: DiskFileType | string, options?: MatchFixtureOptionsType) => R
        : T extends JsonAccessorType
          ? (expected: JsonExpectation, options?: MatchFixtureOptionsType) => R
          : T extends TableAccessorType
            ? (expected: '' | TableRows, options?: TableMatchOptionsType) => Promise<void>
            : T extends DirectoryAccessorType | FilesystemAccessorType
              ? (golden: DiskDirectoryType, options?: MatchFixtureOptionsType) => Promise<void>
              : unknown;

/**
 * A stream accessor, structurally: the augmentation is loaded twice (src and
 * the bundled dist), and CaptureScope's private state makes the two class
 * copies nominally distinct.
 */
type StreamMarker = { readonly raw: string; readonly streamName: string };

/**
 * What vitest's own `toMatch` needs `this` to be on a stream subject — which
 * no assertion is, so vitest's half does not apply and the whole-result half
 * alone answers. The refusal sits on `this` rather than on the argument
 * because the augmented `toMatch` must stay assignable to vitest's own, which
 * takes a string or a RegExp from any subject.
 */
type StreamIsNoValue = { readonly 'a stream is compared whole, or as its .text': never };

/** Every other result accessor: none is a string, so vitest's substring meaning never applies. */
type ResultSubject =
    | ContainerAccessorType
    | DirectoryAccessorType
    | FilesystemAccessorType
    | JsonAccessorType
    | ResponseAccessorType
    | TableAccessorType;

/**
 * What vitest's own `toMatch` needs `this` to be on any other result accessor:
 * a result is compared whole — to a value in place, to its golden — and a
 * container is asserted running, so vitest's half never applies.
 */
type SubjectIsNoValue = { readonly 'a result accessor is compared whole': never };

// ── Vitest matcher type augmentation (CONVENTIONS D1–D3) ──
// Shipped from the shared surface so the ONE published `types` entry carries it.

declare module 'vitest' {
    // ONE interface carries every matcher, and it is `Assertion`: a setup
    // That resolves `vitest`'s types twice (a nested or duplicated install, a
    // `file:` link) picks up one augmentation and not the other when the
    // Matchers are split across two interfaces — a failure that reads as a
    // Regression in the package rather than as a resolution problem. Declared
    // Together, they are present together or absent together.
    //
    // `toMatch` keeps vitest's own signature — a string or a RegExp is a
    // Value — and gains the golden half where the subject has one.
    //
    // The two type parameters are vitest's own, repeated CHARACTER for
    // Character: an augmentation whose parameter list differs from the
    // Declaration it merges into is refused outright (TS2428), so this line
    // Tracks the runner's — `R` is the return shape a promisified assertion
    // Threads through, `T` the received value every branch below keys on.
    // A sync golden returns `R`; every async matcher states `Promise<void>`,
    // Because a golden read across the browser seam is async where the
    // Identical node accessor is sync, and the chai chain cannot infer that.
    // oxlint-disable-next-line typescript/consistent-type-definitions -- a module augmentation MERGES only as an interface: a type alias redeclares the name and every matcher is lost
    interface Assertion<R extends Promise<void> | void = void, T = unknown> {
        /**
         * Assert the table holds zero rows. Async — queries the database. A
         * stream is not a table: an empty one is `expect(result.stderr.text).toBe('')`.
         */
        toBeEmpty: T extends TableAccessorType ? () => Promise<void> : never;
        /**
         * Vitest's `toContain`. A stream is not a string: it is compared as
         * `result.stdout.text`, and handed whole it is refused here — vitest
         * would read it as an empty list, and `.not.toContain` would pass.
         */
        toContain: T extends StreamMarker ? never : (item: unknown) => R;
        /** Assert the container is running. Async — docker-backed subject. */
        toBeRunning: T extends ContainerAccessorType ? () => Promise<void> : never;
        /**
         * On a plain string, vitest's `toMatch` (a string or a RegExp is a
         * value — `result.stdout.text` is one). On a result the framework
         * produced, the WHOLE result against its expectation: the value
         * written in place — a stream's text, a response's `.http` text, a
         * json's value, a table's rows (`await`ed), tokens allowed in each —
         * or `file()`/`directory()` when the expectation lives on disk
         * (`toMatch(file('./expected/help.txt'))`, the extension part of the
         * path; `await expect(result.directory('out')).toMatch(directory('./expected/out/'))`).
         *
         * Pass `{ frozen: true }` to opt a single expectation OUT of update-mode
         * rewriting: a frozen one is never overwritten under `TEST_UPDATE=1`
         * (or vitest `-u`), and a frozen mismatch still throws. Use it for a
         * deliberately-wrong expectation whose diff is the behaviour under test.
         */
        toMatch: ((
            this: T extends StreamMarker
                ? StreamIsNoValue
                : T extends ResultSubject
                  ? SubjectIsNoValue
                  : unknown,
            expected: RegExp | string,
        ) => R) &
            WholeMatch<T, R>;
    }
}
