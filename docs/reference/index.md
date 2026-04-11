# @jterrazz/test

## Classes

| Class | Description |
| ------ | ------ |
| [DockerAssertion](classes/DockerAssertion.md) | Fluent assertion builder for Docker containers |
| [ExecAdapter](classes/ExecAdapter.md) | Executes CLI commands via execSync (blocking) or spawn (long-running). Used by cli() for local command execution. |
| [FetchAdapter](classes/FetchAdapter.md) | Server adapter for real HTTP — sends actual fetch requests. Used by e2e() specification runner. |
| [HonoAdapter](classes/HonoAdapter.md) | Server adapter for Hono — in-process requests, no real HTTP. Used by integration() specification runner. |
| [Orchestrator](classes/Orchestrator.md) | Orchestrator for test infrastructure. Integration: starts services via testcontainers. E2E: runs full docker compose up. |

## Interfaces

| Interface | Description |
| ------ | ------ |
| [CliOptions](interfaces/CliOptions.md) | - |
| [CommandPort](interfaces/CommandPort.md) | Abstract CLI interface for specification runners. Implement this to plug in your command execution strategy. |
| [CommandResult](interfaces/CommandResult.md) | Result of executing a CLI command. |
| [DatabasePort](interfaces/DatabasePort.md) | Abstract database interface for specification runners. Implement this to plug in your database stack. |
| [DirectoryAccessor](interfaces/DirectoryAccessor.md) | - |
| [DirectorySnapshotOptions](interfaces/DirectorySnapshotOptions.md) | - |
| [DockerContainerPort](interfaces/DockerContainerPort.md) | - |
| [DockerInspectResult](interfaces/DockerInspectResult.md) | - |
| [E2eOptions](interfaces/E2eOptions.md) | - |
| [FileAccessor](interfaces/FileAccessor.md) | - |
| [IntegrationOptions](interfaces/IntegrationOptions.md) | - |
| [MockDatePort](interfaces/MockDatePort.md) | - |
| [PostgresOptions](interfaces/PostgresOptions.md) | - |
| [RedisOptions](interfaces/RedisOptions.md) | - |
| [ResponseAccessor](interfaces/ResponseAccessor.md) | - |
| [ServerPort](interfaces/ServerPort.md) | Abstract server interface for specification runners. Integration mode uses in-process app, E2E mode uses real HTTP. |
| [ServerResponse](interfaces/ServerResponse.md) | HTTP response returned by a server port. |
| [ServiceHandle](interfaces/ServiceHandle.md) | A service handle — returned by factory functions like postgres(), redis(). Mutable: connectionString is populated after the orchestrator starts containers. |
| [SpawnOptions](interfaces/SpawnOptions.md) | Options for spawning a long-running process. |
| [SpecificationBuilder](interfaces/SpecificationBuilder.md) | - |
| [SpecificationResult](interfaces/SpecificationResult.md) | - |
| [SpecificationRunnerWithCleanup](interfaces/SpecificationRunnerWithCleanup.md) | - |
| [TableAssertion](interfaces/TableAssertion.md) | - |

## Type Aliases

| Type Alias | Description |
| ------ | ------ |
| [CommandEnv](type-aliases/CommandEnv.md) | Extra environment variables to set for the child process. Values are merged on top of process.env. A `null` value unsets the variable. |
| [MockPort](type-aliases/MockPort.md) | - |

## Variables

| Variable | Description |
| ------ | ------ |
| [mockOf](variables/mockOf.md) | - |
| [mockOfDate](variables/mockOfDate.md) | - |

## Functions

| Function | Description |
| ------ | ------ |
| [cli](functions/cli.md) | Create a CLI specification runner. Runs CLI commands against fixture projects. Optionally starts infrastructure. |
| [dockerContainer](functions/dockerContainer.md) | Create a Docker container port for an existing container |
| [e2e](functions/e2e.md) | Create an E2E specification runner. Starts full docker compose stack. App URL and database auto-detected. |
| [grep](functions/grep.md) | Extract text blocks from output that contain a pattern. Splits by blank lines (how linter/compiler output is structured), returns only blocks matching the pattern. |
| [integration](functions/integration.md) | Create an integration specification runner. Starts infra containers via testcontainers, app runs in-process. |
| [normalizeOutput](functions/normalizeOutput.md) | - |
| [postgres](functions/postgres.md) | Create a PostgreSQL service handle. |
| [redis](functions/redis.md) | Create a Redis service handle. |
| [stripAnsi](functions/stripAnsi.md) | - |
