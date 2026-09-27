import { resolve } from 'node:path';

import { checkoutUnder } from '../../../engine/testing/package-tree.fixtures.js';
import { ruleTester } from '../../../engine/testing/rule-tester.js';
import { stubsRootHoldsFacadesAndKinds } from './stubs-root-holds-facades-and-kinds.js';

const SPECS_LINT = resolve(import.meta.dirname, '../../../../specs/lint');

const FEATURE = '/repo/specs/api/feature/_setup/stubs';

const UNDER_STUBS = checkoutUnder('stubs', ['specs/api/feature']);
const FACADE = `${FEATURE}/newsroom.stubs.ts`;
const UNIT = `${FEATURE}/http/events.ts`;

ruleTester().run('stubs-root-holds-facades-and-kinds', stubsRootHoldsFacadesAndKinds, {
    invalid: [
        // A unit stub left at the _setup/stubs/ root.
        {
            code: `import { defineStub, http } from '@jterrazz/test';\nexport default defineStub({ request: http.get('u'), response: http.json({}) });`,
            errors: [{ column: 0, line: 1, messageId: 'rootFile' }],
            filename: `${FEATURE}/latest.ts`,
        },
        // A facade exporting nothing — a type alone is no builder.
        {
            code: `import { defineStubs } from '@jterrazz/test';\nconst world = defineStubs();\nexport type World = typeof world;`,
            errors: [{ column: 0, line: 1, messageId: 'exportsNothing' }],
            filename: FACADE,
        },
        // A default export that is not a composition.
        {
            code: `export default { stubs: [] };`,
            errors: [{ column: 0, line: 1, messageId: 'notDefineStubs' }],
            filename: FACADE,
        },
        // A call to a builder imported from anything but a facade proves nothing.
        {
            code: `import { pipeline } from '../helpers/pipeline.js';\nexport default pipeline();`,
            errors: [{ column: 0, line: 1, messageId: 'notDefineStubs' }],
            filename: FACADE,
        },
        // A builder of this file declared to return something else.
        {
            code: `function quiet(): object {\n    return {};\n}\nexport default quiet();`,
            errors: [{ column: 0, line: 1, messageId: 'notDefineStubs' }],
            filename: FACADE,
        },
        // A unit stub that is not kebab-case.
        {
            code: `import { defineStub, http } from '@jterrazz/test';\nexport default defineStub({ request: http.get('u'), response: http.json({}) });`,
            errors: [{ column: 0, line: 1, messageId: 'badName' }],
            filename: `${FEATURE}/http/Bad_Name.ts`,
        },
        // A unit stub with no default export.
        {
            code: `import { defineStub, http } from '@jterrazz/test';\nconst stub = defineStub({ request: http.get('u'), response: http.json({}) });`,
            errors: [{ column: 0, line: 1, messageId: 'missingDefault' }],
            filename: UNIT,
        },
        // A default export that produces no stub.
        {
            code: `export default { request: 1 };`,
            errors: [{ column: 0, line: 1, messageId: 'notDefineStub' }],
            filename: UNIT,
        },
        // The folder says openai, every builder the unit calls says http.
        {
            code: `import { defineStub, http } from '@jterrazz/test';\nexport default defineStub({ request: http.get('u'), response: http.json({}) });`,
            errors: [
                { column: 37, line: 2, messageId: 'foreignBuilder' },
                { column: 62, line: 2, messageId: 'foreignBuilder' },
            ],
            filename: `${FEATURE}/openai/classify.ts`,
        },
        // The request is the folder's kind, the reply another's: the unit mixes two kinds.
        {
            code: `import { defineStub, http, openai } from '@jterrazz/test';\nexport default defineStub({ request: openai.chat({ user: 'u' }), response: http.error(500) });`,
            errors: [{ column: 75, line: 2, messageId: 'foreignBuilder' }],
            filename: `${FEATURE}/openai/classify.ts`,
        },
        // A builder renamed at the import is still its kind.
        {
            code: `import { defineStub, openai as ai } from '@jterrazz/test';\nexport default defineStub({ request: ai.chat({ user: 'u' }), response: ai.reply({}) });`,
            errors: [
                { column: 37, line: 2, messageId: 'foreignBuilder' },
                { column: 71, line: 2, messageId: 'foreignBuilder' },
            ],
            filename: UNIT,
        },
        // A namespace import reaches a builder too: `t.http` under `_setup/stubs/openai/` is the http kind.
        {
            code: `import * as t from '@jterrazz/test';\nexport default t.defineStub({ request: t.openai.chat({ user: 'u' }), response: t.http.error(500) });`,
            errors: [{ column: 79, line: 2, messageId: 'foreignBuilder' }],
            filename: `${FEATURE}/openai/classify.ts`,
        },
        // Nested below the kind folder.
        {
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
        // A `stubs` folder above the package is the machine's: a helper of the checkout is no stub.
        {
            code: 'export const helper = 1;',
            filename: `${UNDER_STUBS}/specs/api/feature/helper.ts`,
        },
        // The canonical facade: composed default + a named scenario factory.
        {
            code: `import { defineStubs } from '@jterrazz/test';\nimport events from './http/events.js';\nimport gone from './http/article-gone.js';\nconst world = defineStubs(events);\nexport default world;\nexport const withArticleGone = (id: string) => world.with(gone(id));`,
            filename: FACADE,
        },
        // A facade with no default: its builder and its set exported by name.
        {
            code: `import { defineStubs } from '@jterrazz/test';\nimport events from './http/events.js';\nexport const newsroom = defineStubs(events);\nexport function pipeline(options: { ingestion: string }) {\n    return newsroom.with();\n}`,
            filename: FACADE,
        },
        // A unit built through a namespace import of the entry, with its own kind alone.
        {
            code: `import * as t from '@jterrazz/test';\nexport default t.defineStub({ request: t.http.get('u'), response: t.http.json({}) });`,
            filename: UNIT,
        },
        // A composition re-export is a legitimate default.
        {
            code: `export { default } from './newsroom.stubs.js';`,
            filename: `${FEATURE}/pipeline.stubs.ts`,
        },
        // A scenario of a sibling facade, called: its named exports ARE compositions.
        {
            code: `import { pipeline } from './pipeline.stubs.js';\nexport default pipeline({ ingestion: 'ai-facts' });`,
            filename: FACADE,
        },
        // A scenario of a sibling facade, as a value.
        {
            code: `import { quietWorld } from './pipeline.stubs.js';\nexport default quietWorld;`,
            filename: FACADE,
        },
        // A builder of this file whose declared return type is the composition's.
        {
            code: `import type { Stubs } from '@jterrazz/test';\nimport { base } from './pipeline.stubs.js';\nfunction quiet(): Stubs {\n    return base.world;\n}\nexport default quiet();`,
            filename: FACADE,
        },
        // The canonical unit stub, matching its kind folder.
        {
            code: `import { defineStub, http } from '@jterrazz/test';\nexport default defineStub({ request: http.get('/events'), response: http.json({}) });`,
            filename: UNIT,
        },
        // A factory returning stubs is a unit too.
        {
            code: `import { defineStub, http } from '@jterrazz/test';\nexport default (id: string) => defineStub({ request: http.get('/a/' + id), response: http.error(410) });`,
            filename: `${FEATURE}/http/article-gone.ts`,
        },
        // A name the entry does not bind to a builder is no kind, whatever it is called.
        {
            code: `import { defineStub, openai } from '@jterrazz/test';\nimport * as http from './local-helpers.js';\nexport default defineStub({ request: openai.chat({ user: http.prompt() }), response: openai.reply({}) });`,
            filename: `${FEATURE}/openai/classify.ts`,
        },
        // Matched data exports a value, not a stub.
        {
            code: `export const PROMPT = 'Classify the article';`,
            filename: `${FEATURE}/openai/classify.request.ts`,
        },
        {
            code: 'test("x", () => {});',
            filename: `${SPECS_LINT}/stubs-root-holds-facades-and-kinds/_fixtures/violation/specs/app/widget/widget.test.ts`,
        },
        // The framework's own stubs module is not a feature tree.
        {
            code: `export const x = 1;`,
            filename: '/repo/src/specification/stubs/stub.ts',
        },
    ],
});
