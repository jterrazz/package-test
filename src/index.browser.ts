/**
 * The page's composition root — what `@jterrazz/test` resolves to under the
 * `browser` condition of its `exports` map.
 *
 * The split is the RUNTIME's, never the facets': a page has no `pg`, no
 * `better-sqlite3`, no `node:fs`, so the node entry's module graph cannot load
 * in one. This entry publishes the node entry's types whole, re-exports every
 * value a page can run from its owner, and answers for every node-only name
 * with a stub that throws where it was called ({@link refuse}). The published
 * `types` entry is the node build's, so the two runtimes are ONE type surface
 * and a name can never exist on one side only — `package-exports.test.ts`
 * compares the two builds' names on every run.
 */

import { TextAccessor } from './expectations/text/text.js';
import { componentFacet, registerBrowserMatchers } from './facets/component/index.browser.js';
import type { ComponentChain } from './facets/component/index.js';
import type { Specification } from './facets/specification.js';
import { nodeOnlyClass, refuse } from './kernel/refusals/node-only.js';
import type { postgres as postgresFn } from './world/services/postgres/postgres.adapter.js';
import type {
    processService as processFn,
    ProcessHandle as ProcessHandleClass,
} from './world/services/process/process.adapter.js';
import type { redis as redisFn } from './world/services/redis/redis.adapter.js';
import type { sqlite as sqliteFn } from './world/services/sqlite/sqlite.adapter.js';

// ── The types, whole: the node entry's, which the one `types` entry publishes ──
// oxlint-disable-next-line oxc/no-barrel-file -- the entry IS the barrel: its types are the node entry's by design, so the two runtimes cannot publish two type surfaces
export type * from './index.js';

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

// The module-scope network double, on msw's WORKER — the page's one engine.
export { intercept } from './world/stubs/intercept/page-intercept.js';

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

/**
 * `text()` is real here: only its anchor differs. Under node the accessor
 * remembers the caller's directory so a golden resolves against it; in a page
 * the golden commands read the test's own path server-side, so there is
 * nothing for the accessor to carry.
 */
export function text(value: string): TextAccessor {
    return new TextAccessor(value, 'text', '');
}

// ── Every other value, real in a page: the same owners the node entry names ──
export { directory, file } from './kernel/files/spec-path.js';
export { anthropic } from './world/stubs/anthropic/anthropic.js';
export { http } from './world/stubs/http/http.js';
export { openai } from './world/stubs/openai/openai.js';
export { defineStub, defineStubs } from './world/stubs/stub.js';
export { clock } from './world/clock/clock.js';
export { mockOf } from './world/mocks/mock-of.js';
export {
    banner,
    button,
    complementary,
    content,
    contentinfo,
    dialog,
    disabled,
    enabled,
    field,
    focused,
    form,
    heading,
    link,
    listitem,
    main,
    navigation,
    option,
    region,
    row,
    search,
    selected,
    status,
    table,
    testId,
    valued,
    within,
} from './elements/elements.js';
export { match, Matcher } from './expectations/tokens/match.js';
export { required } from './expectations/conditions/required.js';
export { waitUntil } from './expectations/conditions/wait-until.js';
export { lintReport } from './facets/cli/index.js';
