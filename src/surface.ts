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

import type { RelativePath as RelativePathType } from './model/chain/spec-path.js';
import type { DirectoryAccessor as DirectoryAccessorType } from './model/result/directory.js';
import type { FilesystemAccessor as FilesystemAccessorType } from './model/result/filesystem.js';
import type { JsonAccessor as JsonAccessorType } from './model/result/json.js';
import type { MatchFixtureOptions as MatchFixtureOptionsType } from './model/result/match-options.js';
import type { ResponseAccessor as ResponseAccessorType } from './model/result/response.js';
import type { TableAccessor as TableAccessorType } from './model/result/table.js';
import type { TextAccessor as TextAccessorType } from './model/result/text.js';
import type { ContainerAccessor as ContainerAccessorType } from './seams/docker/container-accessor.js';

// The component facet — the chain lives in whichever build can run it (the
// Page's), and the SHAPE is stated once so both entries publish the same one.
export type {
    ComponentChain,
    ComponentScenario,
    ComponentVisitor,
    RenderSubject,
} from './facets/component/component.types.js';
export type { RenderResult } from './facets/component/component.result.js';
export type { RenderedText } from './facets/component/rendered-text.js';
export type { ComponentUi, DomMount } from './seams/vitest-browser/ui.js';

// Match — dynamic values in assertions and fixtures
export { type CaptureScope, match, Matcher, type MatcherKind } from './model/matching/match.js';

// Accessors a page can build: pure projections over a captured value. TYPES,
// Like every other accessor — `text()` is the one that HANDS one out.
export type { JsonAccessor } from './model/result/json.js';
export type { TableAccessor } from './model/result/table.js';
export type { TextAccessor } from './model/result/text.js';

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

// Contracts — the ONE way to declare what the outside world replies
export { anthropic } from './seams/anthropic/anthropic.js';
export {
    http,
    type HttpContractFilter,
    type HttpResponseInit,
    type HttpStreamInit,
    type SseEvent,
} from './model/contracts/http.js';
export { type TextFilter } from './model/contracts/filters.js';
export { openai } from './seams/openai/openai.js';
export {
    type Contract,
    type ContractInput,
    type Contracts,
    defineContract,
    defineContracts,
} from './model/contracts/contract.js';
export type {
    ContractRequest,
    ContractResponder,
    ContractResponse,
    ContractResponseValue,
    MatchableRequest,
    StreamBody,
} from './model/contracts/types.js';
// The module-scope double — the VALUE is each entry's (one engine per runtime);
// The shape is stated here so the two surfaces can only publish the same one.
export type { Intercept, InterceptOptions, InterceptScope } from './model/contracts/intercept.js';

// Mock
export { mockOf, type MockOfOptions, type MockPort } from './model/doubles/mock-of.js';

// Time — the one primitive, real in both runtimes
export { clock, type PinnedClock } from './model/clock/clock.js';

// Assertions that are not matchers: a value that must be there, and a
// Condition that has to become true.
export { required } from './model/assertions/required.js';
export { waitUntil, type WaitUntilOptions } from './model/assertions/wait-until.js';

// Matcher options (per-call `toMatchFile(path, { frozen })`), and the path
// Every verb that reads the disk takes
export type { MatchFixtureOptions } from './model/result/match-options.js';
export type { RelativePath } from './model/chain/spec-path.js';

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
    // `toMatch` is NOT here: it is vitest's own, and its argument is a value.
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
         * Assert the subject is empty — zero rows for a table (async), an
         * empty stream for a text accessor (console, errors, stdout).
         */
        // Structural marker rather than the class: the augmentation is loaded
        // Twice (src + bundled dist) and CaptureScope's private state makes the
        // Class copies nominally distinct.
        toBeEmpty: T extends TableAccessorType
            ? () => Promise<void>
            : T extends { readonly comparableText: string }
              ? () => Promise<void>
              : never;
        /** Assert the container is running. Async — docker-backed subject. */
        toBeRunning: T extends ContainerAccessorType ? () => Promise<void> : never;
        /**
         * Assert the subject matches a directory golden, named by a path
         * relative to the spec file that ends in `/` — the whole working
         * directory (`result.filesystem`) or one of its directories. Async: the
         * tree is compared on disk.
         *
         * Pass `{ frozen: true }` to opt the golden OUT of update-mode rewriting.
         */
        toMatchDirectory: T extends DirectoryAccessorType | FilesystemAccessorType
            ? (path: RelativePathType<'/'>, options?: MatchFixtureOptionsType) => Promise<void>
            : never;
        /**
         * Assert the subject matches a golden file, named by a path relative to
         * the spec file, extension included (`.http` format for
         * `result.response`). Async for a subject captured INSIDE a page
         * (`result.tree`, `result.html`, … — the file crosses the browser seam
         * through a server command).
         *
         * Pass `{ frozen: true }` to opt a single golden OUT of update-mode
         * rewriting: a frozen golden is never overwritten under `TEST_UPDATE=1`
         * (or vitest `-u`), and a frozen mismatch/missing golden still throws.
         * Use it for a deliberately-wrong golden whose diff/error rendering is
         * the behaviour under test.
         */
        // A stream captured INSIDE a page reads its golden through a server
        // Command, so it is async where the identical node accessor is sync —
        // Told apart by the same kind of structural marker as `toBeEmpty`.
        toMatchFile: T extends { readonly capturedInPage: true }
            ? (path: RelativePathType, options?: MatchFixtureOptionsType) => Promise<void>
            : T extends JsonAccessorType | ResponseAccessorType | TextAccessorType
              ? (path: RelativePathType, options?: MatchFixtureOptionsType) => R
              : never;
        /**
         * Assert the table contains exactly the given rows for the given
         * columns. Cells accept `match.*` dynamic-value matchers. Async —
         * queries the database.
         */
        toMatchRows: T extends TableAccessorType
            ? (expected: {
                  columns: string[];
                  rows: readonly (readonly unknown[])[];
              }) => Promise<void>
            : never;
    }
}
