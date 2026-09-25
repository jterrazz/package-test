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

import { TextAccessor } from './expectations/text/text.js';
import { componentFacet } from './facets/component/component.facet.js';
import type { ComponentChain } from './facets/component/component.facet.js';
import { registerBrowserMatchers } from './facets/component/page/golden.js';
import type { Specification } from './facets/specification.js';
import { nodeOnlyClass, refuse } from './kernel/refusals/node-only.js';
import type { postgres as postgresFn } from './world/services/postgres/postgres.adapter.js';
import type {
    processService as processFn,
    ProcessHandle as ProcessHandleClass,
} from './world/services/process/process.js';
import type { redis as redisFn } from './world/services/redis/redis.adapter.js';
import type { sqlite as sqliteFn } from './world/services/sqlite/sqlite.adapter.js';
import { interceptThrough } from './world/stubs/intercept/intercept.scope.js';
import type { Intercept } from './world/stubs/intercept/intercept.scope.js';
import { registerWorkerStubs } from './world/stubs/interceptor/worker.js';

// The page's own matchers, armed by the import that brought `component` in: a
// Component test writes no setup file and no hook for them.
registerBrowserMatchers();

// ── The component facet — real here, and only here ──
/**
 * The component chain, opened once for the page. It carries no
 * configuration: what every render shares is the project's (`component()` in
 * `vitest.config.ts`), read by the engines where the page provides it.
 */
export const component: ComponentChain = componentFacet.open({});

/**
 * The module-scope network double, on msw's WORKER — the same stubs and
 * the same strictness the node entry publishes, served by the one engine a
 * page has. Everything new in this release that a page can use is real here.
 */
export const intercept: Intercept = interceptThrough(registerWorkerStubs);

// ── The surface both runtimes share ──
// oxlint-disable-next-line oxc/no-barrel-file -- the entry IS the barrel: F1 publishes ONE specifier, so every name a spec imports is re-exported here by design; the module count is the framework's, not this line's
export * from './surface.js';

/**
 * The six constructors, present and refusing. A component test never reaches
 * one: what it renders is a unit, and the assembled product behind an entry is
 * specified from a node project.
 */
export const specification: Specification = {
    api: () => refuse('specification.api()'),
    cli: () => refuse('specification.cli()'),
    integration: () => refuse('specification.integration()'),
    job: () => refuse('specification.job()'),
    mobile: () => refuse('specification.mobile()'),
    website: () => refuse('specification.website()'),
};

// Services — each opens a socket or a file the page does not have.
export const process: typeof processFn = () => refuse('process()');
export const ProcessHandle: typeof ProcessHandleClass = nodeOnlyClass('ProcessHandle');
export const postgres: typeof postgresFn = () => refuse('postgres()');
export const redis: typeof redisFn = () => refuse('redis()');
export const sqlite: typeof sqliteFn = () => refuse('sqlite()');

// The results and the accessors are TYPES on both sides now, published by the
// One `types` entry — so there is nothing for this runtime to stub: a name that
// Never exists at runtime cannot be called in a page either.

/**
 * `text()` is real here: only its anchor differs. Under node the accessor
 * remembers the caller's directory so a golden resolves against it; in a page
 * the golden commands read the test's own path server-side, so there is
 * nothing for the accessor to carry.
 */
export function text(value: string): TextAccessor {
    return new TextAccessor(value, 'text', '');
}
