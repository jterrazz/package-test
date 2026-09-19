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

import type { ContainerAccessor as ContainerAccessorType } from './integrations/docker/container-accessor.js';
import type { DirectoryAccessor as DirectoryAccessorType } from './specification/facets/_common/result/directory.js';
import type { FilesystemAccessor as FilesystemAccessorType } from './specification/facets/_common/result/filesystem.js';
import type { JsonAccessor as JsonAccessorType } from './specification/facets/_common/result/json.js';
import type { MatchFixtureOptions as MatchFixtureOptionsType } from './specification/facets/_common/result/match-options.js';
import type { ResponseAccessor as ResponseAccessorType } from './specification/facets/_common/result/response.js';
import type { TableAccessor as TableAccessorType } from './specification/facets/_common/result/table.js';
import type { TextAccessor as TextAccessorType } from './specification/facets/_common/result/text.js';

// The component facet — the chain lives in whichever build can run it (the
// Page's), and the SHAPE is stated once so both entries publish the same one.
export type {
    ComponentChain,
    ComponentScenario,
    ComponentVisitor,
    RenderSubject,
} from './specification/facets/component/component.types.js';
export type { RenderResult } from './specification/facets/component/component.result.js';
export type { RenderedText } from './specification/facets/component/rendered-text.js';
export type { ComponentUi, DomMount } from './integrations/vitest-browser/ui.js';

// Match — dynamic values in assertions and fixtures
export {
    type CaptureScope,
    match,
    Matcher,
    type MatcherKind,
} from './specification/matching/match.js';

// Accessors a page can build: pure projections over a captured value
export { JsonAccessor } from './specification/facets/_common/result/json.js';
export { TableAccessor } from './specification/facets/_common/result/table.js';
export { TextAccessor } from './specification/facets/_common/result/text.js';

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
} from './specification/ports/browser.port.js';
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
} from './specification/ports/device.port.js';

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
    region,
    row,
    search,
    status,
    table,
    testId,
    within,
} from './specification/facets/website/elements.js';

// Contracts — the ONE way to declare what the outside world replies
export { anthropic } from './integrations/anthropic/anthropic.js';
export {
    http,
    type HttpContractFilter,
    type HttpResponseInit,
} from './specification/contracts/http.js';
export { type TextFilter } from './specification/contracts/filters.js';
export { openai } from './integrations/openai/openai.js';
export {
    type Contract,
    type ContractInput,
    type Contracts,
    defineContract,
    defineContracts,
} from './specification/contracts/contract.js';
export type {
    ContractRequest,
    ContractResponder,
    ContractResponse,
    ContractResponseValue,
    MatchableRequest,
} from './specification/contracts/types.js';

// Mock
export { mockOf, type MockPort } from './vitest/mock-of.js';
export { type MockDatePort, mockOfDate } from './vitest/mock-of-date.js';

// Matcher options (per-call `toMatch(name, { frozen })`)
export type { MatchFixtureOptions } from './specification/facets/_common/result/match-options.js';

// ── Vitest matcher type augmentation (CONVENTIONS D1–D3) ──
// Shipped from the shared surface so the ONE published `types` entry carries it.

declare module 'vitest' {
    // ONE interface carries all four matchers, and it is `Assertion`.
    //
    // `toMatch` has no choice: it is a BUILT-IN declared on `JestAssertion`,
    // Which `Assertion` also extends, so a `Matchers`-only override is shadowed
    // By the native 1-arg signature — only a DIRECT member of `Assertion`
    // Overrides the inherited one, which is what makes `{ frozen }` type. The
    // Other three would work on either interface, and splitting them across the
    // Two was the defect: a setup that resolves `vitest`'s types twice (a nested
    // Or duplicated install, a `file:` link) picks up one augmentation and not
    // The other, so `toMatch` types while `toBeEmpty` does not — a failure that
    // Reads as a regression in the package rather than as a resolution problem.
    // Declared together, they are present together or absent together.
    //
    // The `toMatch` override must stay ASSIGNABLE to the native
    // `(expected: string | RegExp) => void`, so every branch keeps the
    // `RegExp | string` parameter and a void-compatible return.
    // oxlint-disable-next-line typescript/consistent-type-definitions, typescript/no-explicit-any -- a module augmentation MERGES only as an interface (a type alias redeclares the name and every matcher is lost), and `T = any` is the default vitest's own `Assertion` declares
    interface Assertion<T = any> {
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
         * On `@jterrazz/test` accessors: assert the subject matches a fixture
         * file under `_expected/<name>` (flat — a slash creates a subfolder;
         * `.http` format for `result.response`). Async for filesystem/directory
         * subjects (tree compare on disk), and for a subject captured INSIDE a
         * page (`result.tree`, `result.html`, … — the file crosses the browser
         * seam through a server command).
         *
         * Pass `{ frozen: true }` to opt a single fixture OUT of update-mode
         * rewriting: a frozen fixture is never overwritten under `TEST_UPDATE=1`
         * (or vitest `-u`), and a frozen mismatch/missing fixture still throws.
         * Use it for a deliberately-wrong fixture whose diff/error rendering is
         * the behaviour under test.
         */
        // A stream captured INSIDE a page reads its golden through a server
        // Command, so it is async where the identical node accessor is sync —
        // Told apart by the same kind of structural marker as `toBeEmpty`.
        toMatch: T extends DirectoryAccessorType | FilesystemAccessorType
            ? (name: RegExp | string, options?: MatchFixtureOptionsType) => Promise<void>
            : T extends { readonly capturedInPage: true }
              ? (name: RegExp | string, options?: MatchFixtureOptionsType) => Promise<void>
              : T extends JsonAccessorType | ResponseAccessorType | TextAccessorType
                ? (name: RegExp | string, options?: MatchFixtureOptionsType) => void
                : (expected: RegExp | string, options?: MatchFixtureOptionsType) => void;
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
