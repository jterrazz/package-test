import { parseComposeFile } from './integrations/compose/compose-parser.js';
import { ComposeStackAdapter } from './integrations/compose/compose.js';
import { interceptThrough } from './integrations/msw/scope.js';
import type { Intercept } from './integrations/msw/scope.js';
import { postgres } from './integrations/postgres/postgres.js';
import { redis } from './integrations/redis/redis.js';
import { TestcontainersAdapter } from './integrations/testcontainers/testcontainers.js';
import {
    registerComposeServiceFactory,
    registerContainerIntegrations,
} from './specification/facets/_common/registry.js';

// ── The surface both runtimes share (browser-safe) ──
// oxlint-disable-next-line oxc/no-barrel-file -- the entry IS the barrel: F1 publishes ONE specifier, so every name a spec imports is re-exported here by design; the module count is the framework's, not this line's
export * from './surface.js';

// ── Core API — the single import point (CONVENTIONS F1) ──
export { specification } from './specification/facets/_common/specification.js';
/**
 * The module-scope network double, on msw's node server — what a test with no
 * chain to hang contracts on reaches for (chapter 10).
 */
export const intercept: Intercept = interceptThrough(async (contracts) => {
    // Reached through the same lazy import the chain uses: a static one here
    // Would pull the msw engine into every node consumer's graph at load, and
    // The seam exists to be paid for only by the specs that declare a contract.
    const { registerContracts } = await import('./integrations/msw/intercept.js');
    return await registerContracts(contracts);
});
export { component } from './specification/facets/component/component.node.js';
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
    type IntegrationHandle,
    type IntegrationSpecificationOptions,
} from './specification/facets/integration/start-integration.js';
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
export {
    type ProcessOptions,
    /** @deprecated Renamed to `ProcessOptions` in 15.3; removed in 16.0. */
    type ServeOptions,
} from './specification/facets/website/serve.adapter.js';
export { type ServerSpec } from './specification/facets/website/start-website.js';
export {
    processService as process,
    ProcessHandle,
} from './specification/facets/_common/process.js';
export { type DatabaseKeys, type ServiceRecord } from './specification/facets/_common/services.js';

// Facets
export type {
    ApiSpecification,
    CliSpecification,
    DockerSpecConfig,
    IntegrationSpecification,
    JobHandle,
    JobsSpecification,
    MobileSpecification,
    SpecificationConfig,
    WebsiteSpecification,
} from './specification/facets/_common/builder.js';

// Results that read a disk, a database or a container — node only
export { BaseResult, type FileAccessor } from './specification/facets/_common/result/result.js';
export { CliResult } from './specification/facets/cli/result.js';
export { ContainerAccessor } from './integrations/docker/container-accessor.js';
export {
    findContainersByLabel,
    inspectContainer,
    removeContainers,
} from './integrations/docker/docker-lookup.js';
export { CallResult } from './specification/facets/integration/result.js';
export { HttpResult } from './specification/facets/api/result.js';
export { ScreenResult } from './specification/facets/mobile/result.js';
export { FetchResult, PageResult } from './specification/facets/website/result.js';
export { DirectoryAccessor } from './specification/facets/_common/result/directory.js';
export { FilesystemAccessor } from './specification/facets/_common/result/filesystem.js';
export { ResponseAccessor } from './specification/facets/_common/result/response.js';
export { text } from './specification/facets/_common/result/text-subject.js';

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

// Advanced usage — the orchestrator is public; the Exec/Fetch/Hono adapters are
// Internal wiring (driven by the constructors) and deliberately not re-exported.
export { Orchestrator } from './specification/facets/_common/orchestrator.js';

// Services
export { postgres, type PostgresOptions } from './integrations/postgres/postgres.js';
export { redis, type RedisOptions } from './integrations/redis/redis.js';
export { sqlite, type SqliteOptions } from './integrations/sqlite/sqlite.js';

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
