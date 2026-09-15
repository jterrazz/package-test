import { parseComposeFile } from './integrations/compose/compose-parser.js';
import { ComposeStackAdapter } from './integrations/compose/compose.js';
import type { ContainerAccessor as ContainerAccessorType } from './integrations/docker/container-accessor.js';
import { postgres } from './integrations/postgres/postgres.js';
import { redis } from './integrations/redis/redis.js';
import { TestcontainersAdapter } from './integrations/testcontainers/testcontainers.js';
import {
    registerComposeServiceFactory,
    registerContainerIntegrations,
} from './specification/facets/_common/registry.js';
import type { DirectoryAccessor as DirectoryAccessorType } from './specification/facets/_common/result/directory.js';
import type { FilesystemAccessor as FilesystemAccessorType } from './specification/facets/_common/result/filesystem.js';
import type { JsonAccessor as JsonAccessorType } from './specification/facets/_common/result/json.js';
import type { ResponseAccessor as ResponseAccessorType } from './specification/facets/_common/result/response.js';
import type { TableAccessor as TableAccessorType } from './specification/facets/_common/result/table.js';
import type { TextAccessor as TextAccessorType } from './specification/facets/_common/result/text.js';
import type { MatchFixtureOptions as MatchFixtureOptionsType } from './vitest/matchers.js';

// ── Core API — the single import point (CONVENTIONS F1) ──
export { specification } from './specification/facets/_common/specification.js';
export {
    type ApiHandle,
    type ApiSpecificationOptions,
    type HonoApp,
    type SpecificationMode,
} from './specification/facets/api/start-api.js';
export {
    type CliHandle,
    type CliSpecificationOptions,
} from './specification/facets/cli/start-cli.js';
export {
    type LiterateRunFlags,
    type LiterateServeRegistration,
} from './specification/facets/cli/literate.js';
export {
    type SpecDocument,
    type SpecEnvToken,
    type SpecFileAssertion,
    type SpecFixture,
    type SpecKind,
    type SpecRun,
    type SpecServeEntry,
    type SpecStream,
} from './specification/literate/spec-document.js';
export {
    type JobsHandle,
    type JobsSpecificationOptions,
} from './specification/facets/jobs/start-jobs.js';
export {
    type MobileBackendOptions,
    type MobileHandle,
    type MobileSpecificationOptions,
} from './specification/facets/mobile/start-mobile.js';
export {
    type WebsiteBackendOptions,
    type WebsiteHandle,
    type WebsiteSpecificationOptions,
} from './specification/facets/website/start-website.js';
export { type ServeOptions } from './specification/facets/website/serve.adapter.js';
export { type DatabaseKeys, type ServiceRecord } from './specification/facets/_common/services.js';

// Facets
export type {
    ApiSpecification,
    CliSpecification,
    DockerSpecConfig,
    JobHandle,
    JobsSpecification,
    MobileSpecification,
    SpecificationConfig,
    WebsiteSpecification,
} from './specification/facets/_common/builder.js';

// Match — dynamic values in assertions and fixtures
export {
    type CaptureScope,
    match,
    Matcher,
    type MatcherKind,
} from './specification/matching/match.js';

// Results
export { BaseResult, type FileAccessor } from './specification/facets/_common/result/result.js';
export { CliResult } from './specification/facets/cli/result.js';
export { ContainerAccessor } from './integrations/docker/container-accessor.js';
export {
    findContainersByLabel,
    inspectContainer,
    removeContainers,
} from './integrations/docker/docker-lookup.js';
export { HttpResult } from './specification/facets/api/result.js';
export { ScreenResult } from './specification/facets/mobile/result.js';
export { FetchResult, PageResult } from './specification/facets/website/result.js';
export { DirectoryAccessor } from './specification/facets/_common/result/directory.js';
export { FilesystemAccessor } from './specification/facets/_common/result/filesystem.js';
export { JsonAccessor } from './specification/facets/_common/result/json.js';
export { ResponseAccessor } from './specification/facets/_common/result/response.js';
export { text, TextAccessor } from './specification/facets/_common/result/text.js';
export { TableAccessor } from './specification/facets/_common/result/table.js';

// Ports
export type {
    CliEnv,
    CliInput,
    CliOutput,
    CliPort,
    ExecOptions,
} from './specification/ports/cli.port.js';
export type { DatabasePort } from './specification/ports/database.port.js';
export type { IsolationStrategy } from './specification/ports/isolation.port.js';
export type { ServiceHandle } from './specification/ports/service.port.js';
export type { ServerPort, ServerResponse } from './specification/ports/server.port.js';
export type { ContainerPort } from './specification/ports/container.port.js';
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

// The element vocabulary — user-facing descriptors, shared by visit (website)
// And open (mobile) scenarios: ONE vocabulary, two facets. Landmarks are
// Website-only and refuse at runtime on a mobile verb.
export {
    banner,
    button,
    complementary,
    content,
    contentinfo,
    type ElementOptions,
    field,
    form,
    heading,
    link,
    main,
    navigation,
    region,
    search,
    testId,
    within,
} from './specification/facets/website/elements.js';

// Advanced usage — the orchestrator is public; the Exec/Fetch/Hono adapters are
// Internal wiring (driven by the constructors) and deliberately not re-exported.
export { Orchestrator } from './specification/facets/_common/orchestrator.js';

// Services
export { postgres, type PostgresOptions } from './integrations/postgres/postgres.js';
export { redis, type RedisOptions } from './integrations/redis/redis.js';
export { sqlite, type SqliteOptions } from './integrations/sqlite/sqlite.js';

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
export type { MatchFixtureOptions } from './vitest/matchers.js';

// ── Composition root (CONVENTIONS I1) ──
// `specification/` never imports an external dependency: the orchestrator reaches the
// Container runtimes (testcontainers, docker compose + yaml parser) and the
// Service auto-detection factories (postgres, redis) through the integration
// Registry, wired here — the single entry point every consumer imports (F1).

registerContainerIntegrations({
    createComposeStack: (composeFile, projectName) =>
        new ComposeStackAdapter(composeFile, projectName),
    createContainer: (options) => new TestcontainersAdapter(options),
    parseComposeFile,
});

registerComposeServiceFactory('postgres', (service) =>
    postgres({ composeService: service.name, env: service.environment }),
);
registerComposeServiceFactory('redis', (service) => redis({ composeService: service.name }));

// ── Vitest matcher type augmentation (CONVENTIONS D1–D3) ──
// Shipped from the entry point so the built types always carry it.

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
        toBeEmpty: T extends TableAccessorType
            ? () => Promise<void>
            : // Structural marker rather than the class: the augmentation is
              // Loaded twice (src + bundled dist) and CaptureScope's private
              // State makes the class copies nominally distinct.
              T extends { readonly comparableText: string }
              ? () => Promise<void>
              : never;
        /** Assert the container is running. Async — docker-backed subject. */
        toBeRunning: T extends ContainerAccessorType ? () => Promise<void> : never;
        /**
         * On `@jterrazz/test` accessors: assert the subject matches a fixture
         * file under `_expected/<name>` (flat — a slash creates a subfolder;
         * `.http` format for `result.response`). Async for filesystem/directory
         * subjects (tree compare on disk). Other subjects keep vitest-native
         * `toMatch` semantics (string substring / regexp).
         *
         * Pass `{ frozen: true }` to opt a single fixture OUT of update-mode
         * rewriting: a frozen fixture is never overwritten under `TEST_UPDATE=1`
         * (or vitest `-u`), and a frozen mismatch/missing fixture still throws.
         * Use it for a deliberately-wrong fixture whose diff/error rendering is
         * the behaviour under test.
         */
        toMatch: T extends DirectoryAccessorType | FilesystemAccessorType
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
