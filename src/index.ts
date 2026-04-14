// ── Primary API ──
export { spec, type SpecOptions, type SpecRunner } from './spec/spec.js';
export {
    app,
    type AppFactoryResult,
    type AppServices,
    type AppTarget,
    command,
    type CommandTarget,
    type HttpTarget,
    type JobHandle,
    type SpecTarget,
    stack,
    type StackTarget,
} from './spec/targets.js';

// Builder
export {
    createSpecificationRunner,
    SpecificationBuilder,
    type SpecificationConfig,
    type SpecificationRunner,
} from './builder/specification-builder.js';
export { type FileAccessor, SpecificationResult } from './builder/common/result/result.js';
export {
    DirectoryAccessor,
    type DirectorySnapshotOptions,
} from './builder/common/result/directory.js';
export { ResponseAccessor } from './builder/common/result/response.js';
export { TableAssertion } from './builder/common/result/table.js';

// Ports
export type {
    CommandEnv,
    CommandPort,
    CommandResult,
    SpawnOptions,
} from './builder/cli/command.port.js';
export type { DatabasePort } from './adapters/ports/database.port.js';
export type { ServerPort, ServerResponse } from './builder/http/server.port.js';
export type { ContainerPort } from './infra/ports/container.port.js';
export type { IsolationStrategy } from './infra/ports/isolation.port.js';
export type { ServiceHandle } from './infra/ports/service.port.js';

// Adapters (advanced usage)
export { ExecAdapter } from './builder/cli/adapters/exec.adapter.js';
export { FetchAdapter } from './builder/http/adapters/fetch.adapter.js';
export { HonoAdapter } from './builder/http/adapters/hono.adapter.js';
export { Orchestrator } from './infra/orchestrator.js';

// Services (also available via @jterrazz/test/services)
export { postgres, type PostgresOptions } from './adapters/postgres.adapter.js';
export { redis, type RedisOptions } from './adapters/redis.adapter.js';
export { sqlite, type SqliteOptions } from './adapters/sqlite.adapter.js';

// Legacy aliases (backward compatibility)
export { cli, type CliOptions } from './spec/legacy-cli.js';
export { e2e, type E2eOptions } from './spec/legacy-e2e.js';
export {
    integration,
    type IntegrationOptions,
    type SpecificationRunnerWithCleanup,
} from './spec/legacy-integration.js';

// Legacy re-exports (use result.grep() and runner.docker() instead)
export { grep } from './builder/common/result/grep.js';
export { normalizeOutput, stripAnsi } from './builder/common/reporter.js';
export { dockerContainer } from './docker/docker-adapter.js';
export { DockerAssertion } from './docker/docker-assertion.js';
export type { DockerContainerPort, DockerInspectResult } from './docker/docker-port.js';

// Mock (also available via @jterrazz/test/mock)
export * from './mock/index.js';
