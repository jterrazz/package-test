export { specification, type SpecificationConfig } from './facets/specification.js';
// oxlint-disable-next-line oxc/no-barrel-file -- the entry IS the barrel: `no-unpublished-subpath` publishes ONE specifier, so every name a spec imports is re-exported here by design; the module count is the framework's, not this line's
export type * from './facets/api/api.face.js';
export type * from './facets/cli/cli.face.js';
export * from './facets/component/component.face.js';
export type * from './facets/integration/integration.face.js';
export type * from './facets/job/job.face.js';
export type * from './facets/lint/lint.face.js';
export { ruleTester } from './facets/lint/lint.face.js';
export type * from './facets/mobile/mobile.face.js';
export type * from './facets/website/website.face.js';

export type { ChainContext } from './kernel/context/with.capability.js';
export type { TestSettings } from '../lint/engine/project/settings.js';

export {
    directory,
    type DiskDirectory,
    type DiskFile,
    type DiskTarget,
    file,
    type FileAt,
    type RelativePath,
} from './kernel/files/spec-path.js';

export { anthropic } from './world/stubs/kinds/anthropic.js';
export {
    http,
    type HttpResponseInit,
    type HttpStreamInit,
    type HttpStubFilter,
    type SseEvent,
} from './world/stubs/kinds/http.js';
export { type TextFilter } from './world/stubs/kinds/text-filter.js';
export { openai } from './world/stubs/kinds/openai.js';
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
} from './world/stubs/exchange.js';
export { intercept } from './world/stubs/delivery/same-process/intercept.js';
export type {
    Intercept,
    InterceptOptions,
    InterceptScope,
} from './world/stubs/intercept/intercept.js';
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
export { clock, type PinnedClock } from './world/clock/clock.js';
export { mockOf, type MockOfOptions, type MockPort } from './world/mocks/mock-of.js';

export {
    button,
    content,
    dialog,
    field,
    heading,
    link,
    listitem,
    option,
    row,
    status,
    table,
    testId,
} from './visitor/targets/roles.js';
export {
    banner,
    complementary,
    contentinfo,
    form,
    main,
    navigation,
    region,
    search,
    within,
} from './visitor/targets/landmarks.js';
export { disabled, enabled, focused, selected, valued } from './visitor/targets/modifiers.js';
export type { ElementKind, LandmarkKind, Target, TargetOptions } from './visitor/targets/target.js';
export type { ElementMatch } from './visitor/matching/candidates.js';

export {
    type CaptureScope,
    match,
    Matcher,
    type MatcherKind,
} from './expectations/tokens/match.js';
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
export { required } from './expectations/conditions/required.js';
export { waitUntil, type WaitUntilOptions } from './expectations/conditions/wait-until.js';
// Also carries the vitest `Assertion` augmentation: the one `types` entry publishes the matchers through it.
export type { MatchFixtureOptions } from './expectations/goldens/match-options.js';
