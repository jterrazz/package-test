// ── Primary API ──
export { spec, type SpecOptions, type SpecRunner } from './runner/spec.js';
export {
    app,
    type AppServices,
    type AppTarget,
    command,
    type CommandTarget,
    type HttpTarget,
    type SpecTarget,
    stack,
    type StackTarget,
} from './runner/targets.js';

// Builder
export {
    createSpecificationRunner,
    SpecificationBuilder,
    type SpecificationConfig,
    type SpecificationRunner,
} from './builder/specification-builder.js';
export { type FileAccessor, SpecificationResult } from './builder/specification-result.js';
export { DirectoryAccessor, type DirectorySnapshotOptions } from './builder/directory-accessor.js';
export { ResponseAccessor } from './builder/response-accessor.js';
export { TableAssertion } from './builder/table-assertion.js';

// Ports
export type { CommandEnv, CommandPort, CommandResult, SpawnOptions } from './ports/command.port.js';
export type { DatabasePort } from './ports/database.port.js';
export type { ServerPort, ServerResponse } from './ports/server.port.js';
export type { ContainerPort } from './ports/container.port.js';
export type { IsolationStrategy } from './ports/isolation.port.js';
export type { ServiceHandle } from './ports/service.port.js';

// Adapters (advanced usage)
export { ExecAdapter } from './adapters/exec.adapter.js';
export { FetchAdapter } from './adapters/fetch.adapter.js';
export { HonoAdapter } from './adapters/hono.adapter.js';
export { Orchestrator } from './orchestrator/orchestrator.js';

// Services (also available via @jterrazz/test/services)
export { postgres, type PostgresOptions } from './adapters/postgres.adapter.js';
export { redis, type RedisOptions } from './adapters/redis.adapter.js';
export { sqlite, type SqliteOptions } from './adapters/sqlite.adapter.js';

// Legacy aliases (backward compatibility)
export { cli, type CliOptions } from './runner/cli.js';
export { e2e, type E2eOptions } from './runner/e2e.js';
export {
    integration,
    type IntegrationOptions,
    type SpecificationRunnerWithCleanup,
} from './runner/integration.js';

// Legacy re-exports (use result.grep() and runner.docker() instead)
export { grep } from './utilities/grep.js';
export { normalizeOutput, stripAnsi } from './utilities/reporter.js';
export { dockerContainer } from './docker/docker-adapter.js';
export { DockerAssertion } from './docker/docker-assertion.js';
export type { DockerContainerPort, DockerInspectResult } from './docker/docker-port.js';

// Mock (also available via @jterrazz/test/mock)
export * from './mocking/index.js';
