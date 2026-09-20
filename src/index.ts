import { registerContainerIntegrations } from './core/chain/registry.js';
import { interceptThrough } from './core/contracts/intercept.js';
import type { Intercept } from './core/contracts/intercept.js';
import { TestcontainersAdapter } from './seams/testcontainers/testcontainers.js';

// ── The surface both runtimes share (browser-safe) ──
// oxlint-disable-next-line oxc/no-barrel-file -- the entry IS the barrel: F1 publishes ONE specifier, so every name a spec imports is re-exported here by design; the module count is the framework's, not this line's
export * from './surface.js';

// ── Core API — the single import point (CONVENTIONS F1) ──
export { specification } from './facets/specification.js';
/**
 * The module-scope network double, on msw's node server — what a test with no
 * chain to hang contracts on reaches for (chapter 10).
 */
export const intercept: Intercept = interceptThrough(async (contracts) => {
    // Reached through the same lazy import the chain uses: a static one here
    // Would pull the msw engine into every node consumer's graph at load, and
    // The seam exists to be paid for only by the specs that declare a contract.
    const { registerContracts } = await import('./seams/msw/server.js');
    return await registerContracts(contracts);
});
export { component } from './facets/component/component.specification.js';
export {
    type ApiHandle,
    type ApiSpecificationOptions,
    type HonoApp,
} from './facets/api/api.specification.js';
export { type CliHandle, type CliSpecificationOptions } from './facets/cli/cli.specification.js';
export { type LiterateRunFlags, type LiterateServeRegistration } from './facets/cli/literate.js';
export {
    type SpecDocument,
    type SpecEnvToken,
    type SpecFileAssertion,
    type SpecFixture,
    type SpecKind,
    type SpecRun,
    type SpecServeEntry,
    type SpecStream,
} from './core/literate/spec-document.js';
export {
    type IntegrationHandle,
    type IntegrationSpecificationOptions,
} from './facets/integration/integration.specification.js';
export {
    type JobsHandle,
    type JobsSpecificationOptions,
} from './facets/jobs/jobs.specification.js';
export {
    type MobileBackendOptions,
    type MobileHandle,
    type MobileSpecificationOptions,
} from './facets/mobile/mobile.specification.js';
export {
    type WebsiteBackendOptions,
    type WebsiteHandle,
    type WebsiteSpecificationOptions,
} from './facets/website/website.specification.js';
export { type ProcessOptions } from './facets/website/serve.adapter.js';
export { type ServerSpec } from './facets/website/website.specification.js';
export { processService as process, ProcessHandle } from './core/chain/process.js';
export { type DatabaseKeys, type ServiceRecord } from './core/chain/services.js';

// Facets — each chain is named in its own folder, beside the constructor that
// Builds it and the result it hands back (the four files every facet carries).
export type { ApiSpecification } from './facets/api/api.chain.js';
export type { CliSpecification } from './facets/cli/cli.chain.js';
export type { IntegrationSpecification } from './facets/integration/integration.chain.js';
export type { JobsSpecification } from './facets/jobs/jobs.chain.js';
export type { JobsResult } from './facets/jobs/jobs.result.js';
export type { MobileSpecification } from './facets/mobile/mobile.chain.js';
export type { WebsiteSpecification } from './facets/website/website.chain.js';
export type { DockerSpecConfig, JobHandle, SpecificationConfig } from './core/chain/builder.js';

// Results that read a disk, a database or a container — node only.
//
// TYPES, not values. A spec never constructs one and never asks an
// `instanceof`: a result is what a terminal action HANDS BACK, and the only
// thing a consumer needs the name for is annotating a helper that takes one.
// Publishing the classes exported a constructor nobody may call and a
// prototype chain the package is then not free to change.
export type { FileAccessor } from './core/result/result.js';
export type { BaseResult } from './core/result/result.js';
export type { CliResult } from './facets/cli/cli.result.js';
export type { ContainerAccessor } from './seams/docker/container-accessor.js';
export type { CallResult } from './facets/integration/integration.result.js';
export type { HttpResult } from './facets/api/api.result.js';
export type { ScreenResult } from './facets/mobile/mobile.result.js';
export type { FetchResult, PageResult } from './facets/website/website.result.js';
export type { DirectoryAccessor } from './core/result/directory.js';
export type { FilesystemAccessor } from './core/result/filesystem.js';
export type { ResponseAccessor } from './core/result/response.js';
export { text } from './core/result/text-subject.js';

// Ports
export type { CliEnv, CliInput, CliOutput, CliPort, ExecOptions } from './core/ports/cli.port.js';
export type { DatabasePort } from './core/ports/database.port.js';
export type { IsolationStrategy } from './core/ports/isolation.port.js';
export type { ServiceHandle } from './core/ports/service.port.js';
export type { ServerPort, ServerResponse } from './core/ports/server.port.js';
export type { ContainerPort } from './core/ports/container.port.js';

// Services
export { postgres, type PostgresOptions } from './seams/postgres/postgres.js';
export { redis, type RedisOptions } from './seams/redis/redis.js';
export { sqlite, type SqliteOptions } from './seams/sqlite/sqlite.js';

// ── Composition root (CONVENTIONS I1) ──
// `specification/` never imports an external dependency: the orchestrator
// Reaches the container runtime through the integration registry, wired here —
// The single entry point every consumer imports (F1).

registerContainerIntegrations({
    createContainer: (options) => new TestcontainersAdapter(options),
});
