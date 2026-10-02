/** The page's entry: the node entry's types whole, the values a page can run, and a refusing stub for every node-only name. */

import { nodeOnlyClass, refuse } from './chain/refusals/node-only.js';
import type { ruleTester as ruleTesterFn } from './facets/lint/lint.face.js';
import type { Specification } from './facets/specification.js';
import type { postgres as postgresFn } from './services/postgres/postgres.adapter.js';
import type {
    processService as processFn,
    ProcessHandle as ProcessHandleClass,
} from './services/process/process.adapter.js';
import type { redis as redisFn } from './services/redis/redis.adapter.js';
import type { sqlite as sqliteFn } from './services/sqlite/sqlite.adapter.js';

// oxlint-disable-next-line oxc/no-barrel-file -- the entry IS the barrel: its types are the node entry's by design, so the two runtimes cannot publish two type surfaces
export type * from './index.js';

export { component } from './facets/component/component.face.browser.js';
/** The seven constructors, present and refusing in a page. */
export const specification: Specification = {
    api: () => refuse('specification.api()'),
    cli: () => refuse('specification.cli()'),
    integration: () => refuse('specification.integration()'),
    job: () => refuse('specification.job()'),
    lint: () => refuse('specification.lint()'),
    mobile: () => refuse('specification.mobile()'),
    website: () => refuse('specification.website()'),
};
export const ruleTester: typeof ruleTesterFn = () => refuse('ruleTester()');

export const process: typeof processFn = () => refuse('process()');
export const ProcessHandle: typeof ProcessHandleClass = nodeOnlyClass('ProcessHandle');
export const postgres: typeof postgresFn = () => refuse('postgres()');
export const redis: typeof redisFn = () => refuse('redis()');
export const sqlite: typeof sqliteFn = () => refuse('sqlite()');
export { directory, file } from './disk/spec-path.js';
export { anthropic } from './stubs/kinds/anthropic.js';
export { http } from './stubs/kinds/http.js';
export { openai } from './stubs/kinds/openai.js';
export { defineStub, defineStubs } from './stubs/stub.js';
export { intercept } from './stubs/delivery/browser-page/intercept.js';
export { clock } from './clock/clock.js';
export { mockOf } from './mocks/mock-of.js';

export {
    button,
    content,
    dialog,
    field,
    heading,
    link,
    listitem,
    option,
    row,
    status,
    table,
    testId,
} from './visitor/targets/roles.js';
export {
    banner,
    complementary,
    contentinfo,
    form,
    main,
    navigation,
    region,
    search,
    within,
} from './visitor/targets/landmarks.js';
export { disabled, enabled, focused, selected, valued } from './visitor/targets/modifiers.js';

export { match, Matcher } from './expectations/tokens/match.js';
export { text } from './expectations/text/text-subject.browser.js';
export { required } from './expectations/conditions/required.js';
export { waitUntil } from './expectations/conditions/wait-until.js';
