import {
    registerComposeServiceFactory,
    registerContainerIntegrations,
} from './core/specification/shared/registry.js';
import type { DirectoryAccessor as DirectoryAccessorType } from './core/specification/shared/result/directory.js';
import type { FilesystemAccessor as FilesystemAccessorType } from './core/specification/shared/result/filesystem.js';
import type { JsonAccessor as JsonAccessorType } from './core/specification/shared/result/json.js';
import type { ResponseAccessor as ResponseAccessorType } from './core/specification/shared/result/response.js';
import type { TableAccessor as TableAccessorType } from './core/specification/shared/result/table.js';
import type { TextAccessor as TextAccessorType } from './core/specification/shared/result/text.js';
import { parseComposeFile } from './integrations/compose/compose-parser.js';
import { ComposeStackAdapter } from './integrations/compose/compose.js';
import type { ContainerAccessor as ContainerAccessorType } from './integrations/docker/container-accessor.js';
import { postgres } from './integrations/postgres/postgres.js';
import { redis } from './integrations/redis/redis.js';
import { TestcontainersAdapter } from './integrations/testcontainers/testcontainers.js';
import type { MatchFixtureOptions as MatchFixtureOptionsType } from './vitest/matchers.js';

// ── Core API — the single import point (CONVENTIONS F1) ──
export { specification } from './core/specification/shared/specification.js';
export {
    type ApiHandle,
    type ApiSpecificationOptions,
    type HonoApp,
    type SpecificationMode,
} from './core/specification/api/start-api.js';
export {
    type CliHandle,
    type CliSpecificationOptions,
} from './core/specification/cli/start-cli.js';
export {
    type JobsHandle,
    type JobsSpecificationOptions,
} from './core/specification/jobs/start-jobs.js';
export {
    type WebsiteHandle,
    type WebsiteSpecificationOptions,
} from './core/specification/website/start-website.js';
export { type ServeOptions } from './core/specification/website/serve.adapter.js';
export { type DatabaseKeys, type ServiceRecord } from './core/specification/shared/services.js';

// Facets
export type {
    ApiSpecification,
    CliSpecification,
    DockerSpecConfig,
    JobHandle,
    JobsSpecification,
    SpecificationConfig,
    WebsiteSpecification,
} from './core/specification/shared/builder.js';

// Match — dynamic values in assertions and fixtures
export { type CaptureScope, match, Matcher, type MatcherKind } from './core/matching/match.js';

// Results
export { BaseResult, type FileAccessor } from './core/specification/shared/result/result.js';
export { CliResult } from './core/specification/cli/result.js';
export { ContainerAccessor } from './integrations/docker/container-accessor.js';
export {
    findContainersByLabel,
    inspectContainer,
    removeContainers,
} from './integrations/docker/docker-lookup.js';
export { HttpResult } from './core/specification/api/result.js';
export { FetchResult, PageResult } from './core/specification/website/result.js';
export { DirectoryAccessor } from './core/specification/shared/result/directory.js';
export { FilesystemAccessor } from './core/specification/shared/result/filesystem.js';
export { JsonAccessor } from './core/specification/shared/result/json.js';
export { ResponseAccessor } from './core/specification/shared/result/response.js';
export { text, TextAccessor } from './core/specification/shared/result/text.js';
export { TableAccessor } from './core/specification/shared/result/table.js';

// Ports
export type { CliEnv, CliOutput, CliPort, ExecOptions } from './core/ports/cli.port.js';
export type { DatabasePort } from './core/ports/database.port.js';
export type { IsolationStrategy } from './core/ports/isolation.port.js';
export type { ServiceHandle } from './core/ports/service.port.js';
export type { ServerPort, ServerResponse } from './core/ports/server.port.js';
export type { ContainerPort } from './core/ports/container.port.js';
export type {
    BrowserConsoleMessage,
    BrowserLinkElement,
    BrowserMetaElement,
    BrowserOpenOptions,
    BrowserPage,
    BrowserPort,
    ElementRef,
    Visitor,
    VisitScenario,
} from './core/ports/browser.port.js';

// The element vocabulary — user-facing descriptors for visit scenarios
export {
    button,
    content,
    field,
    heading,
    link,
    testId,
} from './core/specification/website/elements.js';

// Advanced usage — the orchestrator is public; the Exec/Fetch/Hono adapters are
// Internal wiring (driven by the constructors) and deliberately not re-exported.
export { Orchestrator } from './core/specification/shared/orchestrator.js';

// Services
export { postgres, type PostgresOptions } from './integrations/postgres/postgres.js';
export { redis, type RedisOptions } from './integrations/redis/redis.js';
export { sqlite, type SqliteOptions } from './integrations/sqlite/sqlite.js';

// Intercepts
export { anthropic } from './integrations/anthropic/anthropic.js';
export { http } from './core/contracts/http.js';
export { openai } from './integrations/openai/openai.js';
export { defineContract, type InterceptContract } from './core/contracts/contract.js';
export type {
    InterceptEntry,
    InterceptResponder,
    InterceptResponse,
    InterceptResponseValue,
    InterceptTrigger,
    MatchableRequest,
} from './core/contracts/types.js';

// Mock
export { mockOf, type MockPort } from './vitest/mock-of.js';
export { type MockDatePort, mockOfDate } from './vitest/mock-of-date.js';

// Matcher options (per-call `toMatch(name, { frozen })`)
export type { MatchFixtureOptions } from './vitest/matchers.js';

// ── Composition root (CONVENTIONS I1) ──
// `core/` never imports an external dependency: the orchestrator reaches the
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

// ── Vitest matcher type augmentation (CONVENTIONS D1–D3) ──
// Shipped from the entry point so the built types always carry it.

declare module 'vitest' {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    interface Matchers<T = any> {
        /**
         * Assert the subject is empty — zero rows for a table (async), an
         * empty stream for a text accessor (console, errors, stdout).
         */
        toBeEmpty: T extends TableAccessorType
            ? () => Promise<void>
            : // Structural marker rather than the class: the augmentation is
              // Loaded twice (src + bundled dist) and CaptureScope's private
              // State makes the class copies nominally distinct.
              T extends { readonly comparableText: string }
              ? () => Promise<void>
              : never;
        /** Assert the container is running. Async — docker-backed subject. */
        toBeRunning: T extends ContainerAccessorType ? () => Promise<void> : never;
        /**
         * Assert the table contains exactly the given rows for the given
         * columns. Cells accept `match.*` dynamic-value matchers. Async —
         * queries the database.
         */
        toMatchRows: T extends TableAccessorType
            ? (expected: {
                  columns: string[];
                  rows: readonly (readonly unknown[])[];
              }) => Promise<void>
            : never;
    }

    // `toMatch` is a BUILT-IN vitest matcher declared on `JestAssertion`, which
    // `Assertion` also extends — a `Matchers`-only override is shadowed by the
    // Native 1-arg signature. Redeclaring it DIRECTLY on `Assertion` (where a
    // Direct member overrides the inherited one) is what makes the `{ frozen }`
    // Option type. The override must stay ASSIGNABLE to the native
    // `(expected: string | RegExp) => void`, so every branch keeps the
    // `RegExp | string` parameter and a void-compatible return.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    interface Assertion<T = any> {
        /**
         * On `@jterrazz/test` accessors: assert the subject matches a fixture
         * file under `expected/<name>` (flat — a slash creates a subfolder;
         * `.http` format for `result.response`). Async for filesystem/directory
         * subjects (tree compare on disk). Other subjects keep vitest-native
         * `toMatch` semantics (string substring / regexp).
         *
         * Pass `{ frozen: true }` to opt a single fixture OUT of update-mode
         * rewriting: a frozen fixture is never overwritten under `TEST_UPDATE=1`
         * (or vitest `-u`), and a frozen mismatch/missing fixture still throws.
         * Use it for a deliberately-wrong fixture whose diff/error rendering is
         * the behaviour under test.
         */
        toMatch: T extends DirectoryAccessorType | FilesystemAccessorType
            ? (name: RegExp | string, options?: MatchFixtureOptionsType) => Promise<void>
            : T extends JsonAccessorType | ResponseAccessorType | TextAccessorType
              ? (name: RegExp | string, options?: MatchFixtureOptionsType) => void
              : (expected: RegExp | string, options?: MatchFixtureOptionsType) => void;
    }
}
