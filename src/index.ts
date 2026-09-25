import { interceptThrough } from './capabilities/intercept/intercept.scope.js';
import type { Intercept } from './capabilities/intercept/intercept.scope.js';
import { registerContainerIntegrations } from './model/services/registry.js';
import { serviceContainers } from './runner/provided.js';
import { ServiceContainer } from './seams/testcontainers/service-container.js';

// ── The surface both runtimes share (browser-safe) ──
// oxlint-disable-next-line oxc/no-barrel-file -- the entry IS the barrel: F1 publishes ONE specifier, so every name a spec imports is re-exported here by design; the module count is the framework's, not this line's
export * from './surface.js';

// ── Core API — the single import point (CONVENTIONS F1) ──
export { specification } from './facets/specification.js';
/**
 * The module-scope network double, on msw's node server — what a test with no
 * chain to hang contracts on reaches for (chapter 16).
 */
export const intercept: Intercept = interceptThrough(async (contracts) => {
    // Reached through the same lazy import the chain uses: a static one here
    // Would pull the msw engine into every node consumer's graph at load, and
    // The seam exists to be paid for only by the specs that declare a contract.
    const { registerContracts } = await import('./seams/msw/server.js');
    return await registerContracts(contracts);
});
export { component } from './facets/component/component.handle.js';
export {
    type ApiHandle,
    type ApiSpecificationOptions,
    type HonoApp,
} from './facets/api/api.handle.js';
export { type CliHandle, type CliSpecificationOptions } from './facets/cli/cli.handle.js';
export { type LiterateRunFlags, type LiterateServeRegistration } from './actions/run/literate.js';
export {
    type SpecDocument,
    type SpecEnvToken,
    type SpecFileAssertion,
    type SpecFixture,
    type SpecRun,
    type SpecServeEntry,
    type SpecStream,
} from './model/literate/spec-document.js';
export {
    type IntegrationHandle,
    type IntegrationSpecificationOptions,
} from './facets/integration/integration.handle.js';
export { type JobsHandle, type JobsSpecificationOptions } from './facets/jobs/jobs.handle.js';
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
export { type ProcessOptions } from './seams/process/serve.adapter.js';
export { type ServerSpec } from './facets/website/website.handle.js';
export { processService as process, ProcessHandle } from './model/services/process.js';
export { type DatabaseKeys, type ServiceRecord } from './model/services/services.js';

// Facets — each chain is named in its own folder, beside the constructor that
// Builds it.
export type { ApiSpecification } from './facets/api/api.chain.js';
export type { CliSpecification } from './facets/cli/cli.chain.js';
export type { IntegrationSpecification } from './facets/integration/integration.chain.js';
export type { JobsSpecification } from './facets/jobs/jobs.chain.js';
export type { JobsResult } from './results/jobs.result.js';
export type { MobileSpecification } from './facets/mobile/mobile.chain.js';
export type { WebsiteSpecification } from './facets/website/website.chain.js';
export type { ChainContext } from './capabilities/with/with.capability.js';
export type { SeedSource } from './capabilities/seed/seed.capability.js';
export type { DockerSpecConfig, JobHandle, SpecificationConfig } from './model/chain/config.js';

// Results that read a disk, a database or a container — node only.
//
// TYPES, not values. A spec never constructs one and never asks an
// `instanceof`: a result is what a terminal action HANDS BACK, and the only
// thing a consumer needs the name for is annotating a helper that takes one.
// Publishing the classes exported a constructor nobody may call and a
// prototype chain the package is then not free to change.
export type { FileAccessor } from './results/result.js';
export type { TestSettings } from './settings.js';
export type { BaseResult } from './results/result.js';
export type { CliResult } from './results/cli.result.js';
export type { ContainerAccessor } from './results/container.js';
export type { CallResult } from './results/call.result.js';
export type { HttpResult } from './results/http.result.js';
export type { ScreenResult } from './results/screen.result.js';
export type { FetchResult } from './results/fetch.result.js';
export type { PageResult } from './results/page.result.js';
export type { DirectoryAccessor } from './results/directory.js';
export type { FilesystemAccessor } from './results/filesystem.js';
export type { ResponseAccessor } from './results/response.js';
export { text } from './results/text-subject.js';

// Ports
export type { CliEnv, CliInput, CliOutput, CliPort, ExecOptions } from './model/ports/cli.port.js';
export type { DatabasePort } from './model/ports/database.port.js';
export type { IsolationStrategy } from './model/ports/isolation.port.js';
export type { ServiceHandle } from './model/ports/service.port.js';
export type {
    ServerPort,
    ServerRequestOptions,
    ServerResponse,
} from './model/ports/server.port.js';
export type { ContainerOptions, ContainerPort } from './model/ports/container.port.js';

// Services
export { postgres, type PostgresOptions } from './seams/postgres/postgres.js';
export { redis, type RedisOptions } from './seams/redis/redis.js';
export { sqlite, type SqliteOptions } from './seams/sqlite/sqlite.js';

// ── Composition root (CONVENTIONS I1) ──
// `specification/` never imports an external dependency: the orchestrator
// Reaches the container runtime through the integration registry, wired here —
// The single entry point every consumer imports (F1).

registerContainerIntegrations({
    createContainer: (request) => new ServiceContainer(request, serviceContainers),
});
