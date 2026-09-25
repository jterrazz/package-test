/**
 * `@jterrazz/test` as node loads it — the single import point (CONVENTIONS
 * F1). Re-exports only: every name is its owner's, and the page's entry
 * (`index.browser.ts`) publishes the same names, the node-only ones refusing.
 */

// ── The constructors, and the facets they open ──
export { specification, type SpecificationConfig } from './facets/specification.js';
// Each facet's face names what it contributes, once.
// oxlint-disable-next-line oxc/no-barrel-file -- the entry IS the barrel: F1 publishes ONE specifier, so every name a spec imports is re-exported here by design; the module count is the framework's, not this line's
export type * from './facets/api/index.js';
export type * from './facets/cli/index.js';
export * from './facets/component/index.js';
export type * from './facets/integration/index.js';
export type * from './facets/job/index.js';
export type * from './facets/mobile/index.js';
export type * from './facets/website/index.js';

// ── What a file shares, and the test section of the config ──
export type { ChainContext } from './kernel/context/with.capability.js';
export type { TestSettings } from './kernel/config/settings.js';

// ── The disk: a string is a value, and what a test stands on is named by one
// Of these two — the only argument a verb that reads the disk accepts ──
export {
    directory,
    type DiskDirectory,
    type DiskFile,
    type DiskTarget,
    file,
    type FileAt,
    type RelativePath,
} from './kernel/files/spec-path.js';

// ── The world: stubs, services, time, doubles ──
// The stubs — the ONE way to declare what the outside world replies.
export { anthropic } from './world/stubs/anthropic/anthropic.js';
export {
    http,
    type HttpResponseInit,
    type HttpStreamInit,
    type HttpStubFilter,
    type SseEvent,
} from './world/stubs/http/http.js';
export { type TextFilter } from './world/stubs/filters.js';
export { openai } from './world/stubs/openai/openai.js';
export {
    defineStub,
    defineStubs,
    type Stub,
    type StubInput,
    type Stubs,
} from './world/stubs/stub.js';
export type {
    MatchableRequest,
    StreamBody,
    StubRequest,
    StubResponder,
    StubResponse,
    StubResponseValue,
} from './world/stubs/exchange/exchange.js';
// The module-scope double: this process's network, on msw's node server.
export { intercept } from './world/stubs/intercept/process-intercept.js';
export type {
    Intercept,
    InterceptOptions,
    InterceptScope,
} from './world/stubs/intercept/intercept.scope.js';
// The services a record declares.
export { postgres, type PostgresOptions } from './world/services/postgres/postgres.adapter.js';
export { redis, type RedisOptions } from './world/services/redis/redis.adapter.js';
export { sqlite, type SqliteOptions } from './world/services/sqlite/sqlite.adapter.js';
export {
    processService as process,
    ProcessHandle,
    type ProcessOptions,
} from './world/services/process/process.adapter.js';
export { type DatabaseKeys, type ServiceRecord } from './world/services/services.js';
export type { SeedSource } from './world/services/seed/seed.capability.js';
export type { DatabasePort } from './world/services/database.port.js';
export type { IsolationStrategy } from './world/services/isolation.port.js';
export type { ServiceHandle } from './world/services/service.port.js';
export type {
    ContainerOptions,
    ContainerPort,
} from './world/services/containers/container.port.js';
// Time — the one primitive, real in both runtimes — and the doubles.
export { clock, type PinnedClock } from './world/clock/clock.js';
export { mockOf, type MockOfOptions, type MockPort } from './world/mocks/mock-of.js';

// ── The elements: ONE vocabulary for visit (website), render (component) and
// Open (mobile); landmarks are website/component-only and refuse on a mobile verb ──
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
} from './elements/elements.js';
export type {
    ElementKind,
    ElementMatch,
    ElementRef,
    LandmarkKind,
} from './elements/element.port.js';

// ── The expectations: tokens, accessors, conditions, goldens ──
export {
    type CaptureScope,
    match,
    Matcher,
    type MatcherKind,
} from './expectations/tokens/match.js';
// Results and accessors are TYPES, not values: a spec never constructs one and
// Never asks an `instanceof` — a result is what a terminal action HANDS BACK,
// And `text()` is the one that hands an accessor out.
export type { BaseResult, FileAccessor } from './expectations/result.js';
export type { CliResult, DockerSpecConfig } from './expectations/command/cli.result.js';
export type { ContainerAccessor } from './expectations/command/container.js';
export type { DirectoryAccessor } from './expectations/disk/directory.js';
export type { FilesystemAccessor } from './expectations/disk/filesystem.js';
export type { ResponseAccessor } from './expectations/http/response.js';
export type { TableAccessor } from './expectations/table/table.js';
export type { JsonAccessor } from './expectations/text/json.js';
export type { TextAccessor } from './expectations/text/text.js';
export { text } from './expectations/text/text-subject.js';
// A value that must be there, and a condition that has to become true.
export { required } from './expectations/conditions/required.js';
export { waitUntil, type WaitUntilOptions } from './expectations/conditions/wait-until.js';
// A linter's report as a golden keeps it — the transform a rule's specs share.
export { lintReport } from './facets/cli/index.js';
// Per-call `toMatch(file(…), { frozen })` — and, beside it, the matchers
// Vitest's `Assertion` gains, carried by the one `types` entry.
export type { MatchFixtureOptions } from './expectations/goldens/match-options.js';
