export type { ContainerPort } from "./ports/container.port.js";
export { TestcontainersAdapter } from "./adapters/testcontainers.adapter.js";
export { detectServiceType, findComposeFile, parseComposeFile } from "./compose-parser.js";
export type { ComposeConfig, ComposeService } from "./compose-parser.js";
export { Orchestrator } from "./orchestrator.js";
export { PostgresService } from "./services/postgres.service.js";
export { RedisService } from "./services/redis.service.js";
