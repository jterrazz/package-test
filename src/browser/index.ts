/**
 * The page's composition root — what `@jterrazz/test` resolves to under the
 * `browser` condition of its `exports` map.
 *
 * The split is the RUNTIME's, never the facets': a page has no `pg`, no
 * `better-sqlite3`, no `node:fs`, so the node entry's module graph cannot load
 * in one. This entry re-exports the shared surface verbatim and answers for
 * every node-only name with a stub that throws where it was called
 * ({@link nodeOnlyFunction}). The published `types` entry is the node build's,
 * so the two surfaces are ONE type surface and a name can never exist on one
 * side only.
 */

import type { ContainerAccessor as ContainerAccessorClass } from '../integrations/docker/container-accessor.js';
import type {
    findContainersByLabel as findContainersByLabelFn,
    inspectContainer as inspectContainerFn,
    removeContainers as removeContainersFn,
} from '../integrations/docker/docker-lookup.js';
import type { postgres as postgresFn } from '../integrations/postgres/postgres.js';
import type { redis as redisFn } from '../integrations/redis/redis.js';
import type { sqlite as sqliteFn } from '../integrations/sqlite/sqlite.js';
import type { Orchestrator as OrchestratorClass } from '../specification/facets/_common/orchestrator.js';
import type { DirectoryAccessor as DirectoryAccessorClass } from '../specification/facets/_common/result/directory.js';
import type { FilesystemAccessor as FilesystemAccessorClass } from '../specification/facets/_common/result/filesystem.js';
import type { ResponseAccessor as ResponseAccessorClass } from '../specification/facets/_common/result/response.js';
import type { BaseResult as BaseResultClass } from '../specification/facets/_common/result/result.js';
import { TextAccessor } from '../specification/facets/_common/result/text.js';
import type { Specification } from '../specification/facets/_common/specification.js';
import type { HttpResult as HttpResultClass } from '../specification/facets/api/result.js';
import type { CliResult as CliResultClass } from '../specification/facets/cli/result.js';
import type { ScreenResult as ScreenResultClass } from '../specification/facets/mobile/result.js';
import type {
    FetchResult as FetchResultClass,
    PageResult as PageResultClass,
} from '../specification/facets/website/result.js';
import { nodeOnlyClass, refuse } from './node-only.js';

// ── The surface both runtimes share ──
// oxlint-disable-next-line oxc/no-barrel-file -- the entry IS the barrel: F1 publishes ONE specifier, so every name a spec imports is re-exported here by design; the module count is the framework's, not this line's
export * from '../surface.js';

/**
 * The five constructors, present and refusing. A component test never reaches
 * one: what it renders is a unit, and the assembled product behind an entry is
 * specified from a node project.
 */
export const specification: Specification = {
    api: () => refuse('specification.api()'),
    cli: () => refuse('specification.cli()'),
    jobs: () => refuse('specification.jobs()'),
    mobile: () => refuse('specification.mobile()'),
    website: () => refuse('specification.website()'),
};

// Services — each opens a socket or a file the page does not have.
export const postgres: typeof postgresFn = () => refuse('postgres()');
export const redis: typeof redisFn = () => refuse('redis()');
export const sqlite: typeof sqliteFn = () => refuse('sqlite()');

// Docker — the container lifecycle and the `docker` CLI behind it.
export const ContainerAccessor: typeof ContainerAccessorClass = nodeOnlyClass('ContainerAccessor');
export const findContainersByLabel: typeof findContainersByLabelFn = () =>
    refuse('findContainersByLabel()');
export const inspectContainer: typeof inspectContainerFn = () => refuse('inspectContainer()');
export const removeContainers: typeof removeContainersFn = () => refuse('removeContainers()');
export const Orchestrator: typeof OrchestratorClass = nodeOnlyClass('Orchestrator');

// Results built from a disk walk, a database or a child process.
export const BaseResult: typeof BaseResultClass = nodeOnlyClass('BaseResult');
export const CliResult: typeof CliResultClass = nodeOnlyClass('CliResult');
export const DirectoryAccessor: typeof DirectoryAccessorClass = nodeOnlyClass('DirectoryAccessor');
export const FetchResult: typeof FetchResultClass = nodeOnlyClass('FetchResult');
export const FilesystemAccessor: typeof FilesystemAccessorClass =
    nodeOnlyClass('FilesystemAccessor');
export const HttpResult: typeof HttpResultClass = nodeOnlyClass('HttpResult');
export const PageResult: typeof PageResultClass = nodeOnlyClass('PageResult');
export const ResponseAccessor: typeof ResponseAccessorClass = nodeOnlyClass('ResponseAccessor');
export const ScreenResult: typeof ScreenResultClass = nodeOnlyClass('ScreenResult');

/**
 * `text()` is real here: only its anchor differs. Under node the accessor
 * remembers the caller's directory so a golden resolves against it; in a page
 * the golden commands read the test's own path server-side, so there is
 * nothing for the accessor to carry.
 */
export function text(value: string): TextAccessor {
    return new TextAccessor(value, 'text', '');
}
