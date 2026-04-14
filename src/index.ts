// ── Core API ──
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
} from './spec/builder.js';

// Results
export { BaseResult, type FileAccessor } from './spec/common/result/result.js';
export { CliResult } from './spec/cli/result.js';
export { HttpResult } from './spec/http/result.js';
export {
    DirectoryAccessor,
    type DirectorySnapshotOptions,
} from './spec/common/result/directory.js';
export { ResponseAccessor } from './spec/common/result/response.js';
export { TableAssertion } from './spec/common/result/table.js';

// Ports
export type {
    CommandEnv,
    CommandPort,
    CommandResult,
    SpawnOptions,
} from './spec/cli/command.port.js';
export type { DatabasePort } from './spec/common/ports/database.port.js';
export type { IsolationStrategy } from './spec/common/ports/isolation.port.js';
export type { ServiceHandle } from './spec/common/ports/service.port.js';
export type { ServerPort, ServerResponse } from './spec/http/server.port.js';
export type { ContainerPort } from './infra/containers/container.port.js';

// Adapters (advanced usage)
export { ExecAdapter } from './spec/cli/adapters/exec.adapter.js';
export { FetchAdapter } from './spec/http/adapters/fetch.adapter.js';
export { HonoAdapter } from './spec/http/adapters/hono.adapter.js';
export { Orchestrator } from './infra/orchestrator.js';

// Services (also available via @jterrazz/test/services)
export { postgres, type PostgresOptions } from './services/postgres.js';
export { redis, type RedisOptions } from './services/redis.js';
export { sqlite, type SqliteOptions } from './services/sqlite.js';

// Docker (advanced usage)
export { dockerContainer } from './infra/docker/docker.js';
export { DockerAssertion } from './infra/docker/docker-assertion.js';
export type { DockerContainerPort, DockerInspectResult } from './infra/docker/docker.port.js';

// Mock (also available via @jterrazz/test/mock)
export * from './mock/index.js';
