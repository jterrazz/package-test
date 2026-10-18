import { ruleTester } from '@jterrazz/test';
import { resolve } from 'node:path';

import { checkoutUnder } from '../../../../__tests__/package-tree.fixtures.js';
import { stubsRootHoldsFacadesAndKinds } from '../stubs-root-holds-facades-and-kinds.js';

const SPECS_LINT = resolve(import.meta.dirname, '../../../../../specs/lint');

const FEATURE = '/repo/specs/api/feature/__setup__/stubs';

const UNDER_STUBS = checkoutUnder('stubs', ['specs/api/feature']);
const FACADE = `${FEATURE}/newsroom.stubs.ts`;
const UNIT = `${FEATURE}/http/events.ts`;

ruleTester().run('stubs-root-holds-facades-and-kinds', stubsRootHoldsFacadesAndKinds, {
    invalid: [
        {
            name: 'Another call through the entry namespace is no stub, and a unit exporting only by name has no default.',
            code: `import * as t from '@jterrazz/test/stubs';\nexport default t.other({});`,
            errors: [{ column: 0, line: 1, messageId: 'notDefineStub' }],
            filename: UNIT,
        },
        {
            code: `import { defineStub, http } from '@jterrazz/test/stubs';\nexport const stub = defineStub({ request: http.get('u'), response: http.json({}) });`,
            errors: [{ column: 0, line: 1, messageId: 'missingDefault' }],
            filename: UNIT,
        },
        {
            name: 'A facade naming a local as its default, built from no stubs, composes nothing.',
            code: `import { quiet } from '../helpers.js';\nexport { quiet as default };`,
            errors: [{ column: 0, line: 1, messageId: 'notDefineStubs' }],
            filename: FACADE,
        },
        {
            name: 'A constructed defineStub, another call, or defineStub through no namespace of the entry, is no stub.',
            code: `import { defineStub } from '@jterrazz/test/stubs';\nexport default new defineStub({});`,
            errors: [{ column: 0, line: 1, messageId: 'notDefineStub' }],
            filename: UNIT,
        },
        {
            code: `export default build();`,
            errors: [{ column: 0, line: 1, messageId: 'notDefineStub' }],
            filename: UNIT,
        },
        {
            code: `import * as x from './mine.js';\nexport default x.defineStub({});`,
            errors: [{ column: 0, line: 1, messageId: 'notDefineStub' }],
            filename: UNIT,
        },
        {
            name: 'A unit stub left at the __setup__/stubs/ root.',
            code: `import { defineStub, http } from '@jterrazz/test/stubs';\nexport default defineStub({ request: http.get('u'), response: http.json({}) });`,
            errors: [{ column: 0, line: 1, messageId: 'rootFile' }],
            filename: `${FEATURE}/latest.ts`,
        },
        {
            name: 'A facade exporting nothing — a type alone is no builder.',
            code: `import { defineStubs } from '@jterrazz/test/stubs';\nconst world = defineStubs();\nexport type World = typeof world;`,
            errors: [{ column: 0, line: 1, messageId: 'exportsNothing' }],
            filename: FACADE,
        },
        {
            name: 'A default export that is not a composition.',
            code: `export default { stubs: [] };`,
            errors: [{ column: 0, line: 1, messageId: 'notDefineStubs' }],
            filename: FACADE,
        },
        {
            name: 'A call to a builder imported from anything but a facade proves nothing.',
            code: `import { pipeline } from '../helpers/pipeline.js';\nexport default pipeline();`,
            errors: [{ column: 0, line: 1, messageId: 'notDefineStubs' }],
            filename: FACADE,
        },
        {
            name: 'A builder of this file declared to return something else.',
            code: `function quiet(): object {\n    return {};\n}\nexport default quiet();`,
            errors: [{ column: 0, line: 1, messageId: 'notDefineStubs' }],
            filename: FACADE,
        },
        {
            name: 'A unit stub that is not kebab-case.',
            code: `import { defineStub, http } from '@jterrazz/test/stubs';\nexport default defineStub({ request: http.get('u'), response: http.json({}) });`,
            errors: [{ column: 0, line: 1, messageId: 'badName' }],
            filename: `${FEATURE}/http/Bad_Name.ts`,
        },
        {
            name: 'A unit stub with no default export.',
            code: `import { defineStub, http } from '@jterrazz/test/stubs';\nconst stub = defineStub({ request: http.get('u'), response: http.json({}) });`,
            errors: [{ column: 0, line: 1, messageId: 'missingDefault' }],
            filename: UNIT,
        },
        {
            name: 'A default export that produces no stub.',
            code: `export default { request: 1 };`,
            errors: [{ column: 0, line: 1, messageId: 'notDefineStub' }],
            filename: UNIT,
        },
        {
            name: 'The folder says openai, every builder the unit calls says http.',
            code: `import { defineStub, http } from '@jterrazz/test/stubs';\nexport default defineStub({ request: http.get('u'), response: http.json({}) });`,
            errors: [
                { column: 37, line: 2, messageId: 'foreignBuilder' },
                { column: 62, line: 2, messageId: 'foreignBuilder' },
            ],
            filename: `${FEATURE}/openai/classify.ts`,
        },
        {
            name: "The request is the folder's kind, the reply another's: the unit mixes two kinds.",
            code: `import { defineStub, http, openai } from '@jterrazz/test/stubs';\nexport default defineStub({ request: openai.chat({ user: 'u' }), response: http.error(500) });`,
            errors: [{ column: 75, line: 2, messageId: 'foreignBuilder' }],
            filename: `${FEATURE}/openai/classify.ts`,
        },
        {
            name: 'A builder renamed at the import is still its kind.',
            code: `import { defineStub, openai as ai } from '@jterrazz/test/stubs';\nexport default defineStub({ request: ai.chat({ user: 'u' }), response: ai.reply({}) });`,
            errors: [
                { column: 37, line: 2, messageId: 'foreignBuilder' },
                { column: 71, line: 2, messageId: 'foreignBuilder' },
            ],
            filename: UNIT,
        },
        {
            name: 'A namespace import reaches a builder too: `t.http` under `__setup__/stubs/openai/` is the http kind.',
            code: `import * as t from '@jterrazz/test/stubs';\nexport default t.defineStub({ request: t.openai.chat({ user: 'u' }), response: t.http.error(500) });`,
            errors: [{ column: 79, line: 2, messageId: 'foreignBuilder' }],
            filename: `${FEATURE}/openai/classify.ts`,
        },
        {
            name: 'Nested below the kind folder.',
            code: `export default 1;`,
            errors: [{ column: 0, line: 1, messageId: 'tooDeep' }],
            filename: `${FEATURE}/http/nested/events.ts`,
        },
        {
            code: `export default 1;`,
            errors: [{ column: 0, line: 1, messageId: 'badKindDir' }],
            filename: `${FEATURE}/grpc/thing.ts`,
        },
    ],
    valid: [
        {
            name: 'A unit default-exports a function, a named function, a value built above, or the default of another.',
            code: `import { defineStub, http } from '@jterrazz/test/stubs';\nexport default function (id: string) {\n    return defineStub({ request: http.get(id), response: http.json({}) });\n}`,
            filename: UNIT,
        },
        {
            code: `import { defineStub, http } from '@jterrazz/test/stubs';\nexport default (function gone(id: string) {\n    return defineStub({ request: http.get(id), response: http.json({}) });\n});`,
            filename: UNIT,
        },
        {
            code: `import { defineStub, http } from '../../../../../../src/index.stubs.js';\nconst stub = defineStub({ request: http.get('u'), response: http.json({}) });\nexport default stub;`,
            filename: UNIT,
        },
        {
            name: 'A builder of another package is no kind: an SDK named `openai` in an http unit.',
            code: `import { openai } from 'openai-sdk';\nimport { defineStub, http } from '@jterrazz/test/stubs';\nexport default defineStub({ request: http.get(openai.base), response: http.json({}) });`,
            filename: UNIT,
        },
        {
            code: `export { default } from './other.js';`,
            filename: UNIT,
        },
        {
            name: 'What no import of the entry binds as a builder — a re-export, a name no kind holds, a member of no namespace — is no kind.',
            code: `import { defineStub, http, notAKind } from '@jterrazz/test/stubs';\nimport * as t from '@jterrazz/test/stubs';\nexport { openai } from '@jterrazz/test/stubs';\nexport default defineStub({ request: http.get(notAKind.x, t.notAKind, other.openai.chat()), response: openai.reply({}) });`,
            filename: UNIT,
        },
        {
            name: 'A facade re-exporting everything of another exports by name.',
            code: `export * from './newsroom.stubs.js';`,
            filename: `${FEATURE}/pipeline.stubs.ts`,
        },
        {
            name: "A `stubs` folder above the package is the machine's: a helper of the checkout is no stub.",
            code: 'export const helper = 1;',
            filename: `${UNDER_STUBS}/specs/api/feature/helper.ts`,
        },
        {
            name: 'The canonical facade: composed default + a named scenario factory.',
            code: `import { defineStubs } from '@jterrazz/test/stubs';\nimport events from './http/events.js';\nimport gone from './http/article-gone.js';\nconst world = defineStubs(events);\nexport default world;\nexport const withArticleGone = (id: string) => world.with(gone(id));`,
            filename: FACADE,
        },
        {
            name: 'A facade with no default: its builder and its set exported by name.',
            code: `import { defineStubs } from '@jterrazz/test/stubs';\nimport events from './http/events.js';\nexport const newsroom = defineStubs(events);\nexport function pipeline(options: { ingestion: string }) {\n    return newsroom.with();\n}`,
            filename: FACADE,
        },
        {
            name: 'A unit built through a namespace import of the entry, with its own kind alone.',
            code: `import * as t from '@jterrazz/test/stubs';\nexport default t.defineStub({ request: t.http.get('u'), response: t.http.json({}) });`,
            filename: UNIT,
        },
        {
            name: 'A composition re-export is a legitimate default.',
            code: `export { default } from './newsroom.stubs.js';`,
            filename: `${FEATURE}/pipeline.stubs.ts`,
        },
        {
            name: 'A scenario of a sibling facade, called: its named exports ARE compositions.',
            code: `import { pipeline } from './pipeline.stubs.js';\nexport default pipeline({ ingestion: 'ai-facts' });`,
            filename: FACADE,
        },
        {
            name: 'A scenario of a sibling facade, as a value.',
            code: `import { quietWorld } from './pipeline.stubs.js';\nexport default quietWorld;`,
            filename: FACADE,
        },
        {
            name: "A builder of this file whose declared return type is the composition's.",
            code: `import type { Stubs } from '@jterrazz/test/stubs';\nimport { base } from './pipeline.stubs.js';\nfunction quiet(): Stubs {\n    return base.world;\n}\nexport default quiet();`,
            filename: FACADE,
        },
        {
            name: 'The canonical unit stub, matching its kind folder.',
            code: `import { defineStub, http } from '@jterrazz/test/stubs';\nexport default defineStub({ request: http.get('/events'), response: http.json({}) });`,
            filename: UNIT,
        },
        {
            name: 'A factory returning stubs is a unit too.',
            code: `import { defineStub, http } from '@jterrazz/test/stubs';\nexport default (id: string) => defineStub({ request: http.get('/a/' + id), response: http.error(410) });`,
            filename: `${FEATURE}/http/article-gone.ts`,
        },
        {
            name: 'A name the entry does not bind to a builder is no kind, whatever it is called.',
            code: `import { defineStub, openai } from '@jterrazz/test/stubs';\nimport * as http from './local-helpers.js';\nexport default defineStub({ request: openai.chat({ user: http.prompt() }), response: openai.reply({}) });`,
            filename: `${FEATURE}/openai/classify.ts`,
        },
        {
            name: 'Matched data exports a value, not a stub.',
            code: `export const PROMPT = 'Classify the article';`,
            filename: `${FEATURE}/openai/classify.request.ts`,
        },
        {
            code: 'test("x", () => {});',
            filename: `${SPECS_LINT}/stubs-root-holds-facades-and-kinds/__fixtures__/violation/specs/app/widget/widget.test.ts`,
        },
        {
            name: "The framework's own stubs module is not a feature tree.",
            code: `export const x = 1;`,
            filename: '/repo/src/specification/stubs/stub.ts',
        },
    ],
});
