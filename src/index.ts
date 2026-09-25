import { serviceContainers } from './vitest/provided.js';
import { ServiceContainer } from './world/services/containers/service-container.js';
import { registerContainerIntegrations } from './world/services/startup/registry.js';
import { interceptThrough } from './world/stubs/intercept/intercept.scope.js';
import type { Intercept } from './world/stubs/intercept/intercept.scope.js';

// ── The surface both runtimes share (browser-safe) ──
// oxlint-disable-next-line oxc/no-barrel-file -- the entry IS the barrel: F1 publishes ONE specifier, so every name a spec imports is re-exported here by design; the module count is the framework's, not this line's
export * from './surface.js';

// ── Core API — the single import point (CONVENTIONS F1) ──
export { specification } from './facets/specification.js';
/**
 * The module-scope network double, on msw's node server — what a test with no
 * chain to hang stubs on reaches for (chapter 16).
 */
export const intercept: Intercept = interceptThrough(async (stubs) => {
    // Reached through the same lazy import the chain uses: a static one here
    // Would pull the msw engine into every node consumer's graph at load, and
    // The seam exists to be paid for only by the specs that declare a stub.
    const { registerStubs } = await import('./world/stubs/interceptor/server.js');
    return await registerStubs(stubs);
});
export { component } from './facets/component/component.handle.js';
export {
    type ApiHandle,
    type ApiSpecificationOptions,
    type HonoApp,
} from './facets/api/api.handle.js';
export { type CliHandle, type CliSpecificationOptions } from './facets/cli/cli.handle.js';
export type { LiterateRunFlags } from './facets/cli/documents/literate.js';
export {
    type SpecDocument,
    type SpecEnvToken,
    type SpecFileAssertion,
    type SpecFixture,
    type SpecRun,
    type SpecServeEntry,
    type SpecStream,
} from './facets/cli/documents/spec-document.js';
export {
    type IntegrationHandle,
    type IntegrationSpecificationOptions,
} from './facets/integration/integration.handle.js';
export { type JobHandle, type JobSpecificationOptions } from './facets/job/job.handle.js';
export {
    type MobileBackendOptions,
    type MobileHandle,
    type MobileSpecificationOptions,
} from './facets/mobile/mobile.handle.js';
export {
    type WebsiteBackendOptions,
    type WebsiteHandle,
    type WebsiteSpecificationOptions,
} from './facets/website/website.handle.js';
export { type ProcessOptions } from './world/services/process/serve.adapter.js';
export { type ServerSpec } from './facets/website/website.handle.js';
export { processService as process, ProcessHandle } from './world/services/process/process.js';
export { type DatabaseKeys, type ServiceRecord } from './world/services/services.js';

// Facets — each chain is named in its own folder, beside the constructor that
// Builds it.
export type { ApiSpecification } from './facets/api/api.facet.js';
export type { CliSpecification } from './facets/cli/cli.facet.js';
export type { IntegrationSpecification } from './facets/integration/integration.facet.js';
export type { JobSpecification } from './facets/job/job.facet.js';
export type { JobResult } from './facets/job/job.result.js';
export type { MobileSpecification } from './facets/mobile/mobile.facet.js';
export type { WebsiteSpecification } from './facets/website/website.facet.js';
export type { ChainContext } from './kernel/context/with.capability.js';
export type { SeedSource } from './world/services/seed/seed.capability.js';
export type {
    DockerSpecConfig,
    Job,
    LiterateServeRegistration,
    SpecificationConfig,
} from './kernel/chain/config.js';

// Results that read a disk, a database or a container — node only.
//
// TYPES, not values. A spec never constructs one and never asks an
// `instanceof`: a result is what a terminal action HANDS BACK, and the only
// thing a consumer needs the name for is annotating a helper that takes one.
// Publishing the classes exported a constructor nobody may call and a
// prototype chain the package is then not free to change.
export type { FileAccessor } from './expectations/result.js';
export type { TestSettings } from './kernel/config/settings.js';
export type { BaseResult } from './expectations/result.js';
export type { CliResult } from './expectations/command/cli.result.js';
export type { ContainerAccessor } from './expectations/command/container.js';
export type { CallResult } from './facets/integration/call.result.js';
export type { HttpResult } from './facets/api/request/http.result.js';
export type { ScreenResult } from './facets/mobile/screen/screen.result.js';
export type { FetchResult } from './facets/website/fetch/fetch.result.js';
export type { PageResult } from './facets/website/visit/page.result.js';
export type { DirectoryAccessor } from './expectations/disk/directory.js';
export type { FilesystemAccessor } from './expectations/disk/filesystem.js';
export type { ResponseAccessor } from './expectations/http/response.js';
export { text } from './expectations/text/text-subject.js';

// Ports
export type {
    CliEnv,
    CliInput,
    CliOutput,
    CliPort,
    ExecOptions,
} from './facets/cli/process/cli.port.js';
export type { DatabasePort } from './world/services/database.port.js';
export type { IsolationStrategy } from './world/services/isolation.port.js';
export type { ServiceHandle } from './world/services/service.port.js';
export type {
    ServerPort,
    ServerRequestOptions,
    ServerResponse,
} from './facets/api/server/server.port.js';
export type {
    ContainerOptions,
    ContainerPort,
} from './world/services/containers/container.port.js';

// Services
export { postgres, type PostgresOptions } from './world/services/postgres/postgres.adapter.js';
export { redis, type RedisOptions } from './world/services/redis/redis.adapter.js';
export { sqlite, type SqliteOptions } from './world/services/sqlite/sqlite.adapter.js';

// ── Composition root (CONVENTIONS I1) ──
// `specification/` never imports an external dependency: the orchestrator
// Reaches the container runtime through the integration registry, wired here —
// The single entry point every consumer imports (F1).

registerContainerIntegrations({
    createContainer: (request) => new ServiceContainer(request, serviceContainers),
});
