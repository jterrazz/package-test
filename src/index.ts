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
export { BaseResult, type FileAccessor } from './spec/result/result.js';
export { CliResult } from './spec/modes/cli/result.js';
export { HttpResult } from './spec/modes/http/result.js';
export { DirectoryAccessor, type DirectorySnapshotOptions } from './spec/result/directory.js';
export { ResponseAccessor } from './spec/result/response.js';
export { TableAssertion } from './spec/result/table.js';

// Ports
export type {
    CommandEnv,
    CommandPort,
    CommandResult,
    SpawnOptions,
} from './spec/modes/cli/command.port.js';
export type { DatabasePort } from './spec/ports/database.port.js';
export type { IsolationStrategy } from './spec/ports/isolation.port.js';
export type { ServiceHandle } from './spec/ports/service.port.js';
export type { ServerPort, ServerResponse } from './spec/modes/http/server.port.js';
export type { ContainerPort } from './infra/containers/container.port.js';

// Adapters (advanced usage)
export { ExecAdapter } from './spec/modes/cli/adapters/exec.adapter.js';
export { FetchAdapter } from './spec/modes/http/adapters/fetch.adapter.js';
export { HonoAdapter } from './spec/modes/http/adapters/hono.adapter.js';
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
