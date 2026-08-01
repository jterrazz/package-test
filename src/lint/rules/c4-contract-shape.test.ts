import { resolve } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { c4ContractShape } from './c4-contract-shape.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

/** The layout half is fs-anchored — it runs against the shared fixture trees. */
const FIXTURES = resolve(import.meta.dirname, '../../../specs/fixtures/lint-violations');

const FEATURE = '/repo/specs/api/feature/contracts';
const FACADE = `${FEATURE}/newsroom.contracts.ts`;
const UNIT = `${FEATURE}/http/events.ts`;

ruleTester.run('c4-contract-shape', c4ContractShape as unknown as OxlintRule, {
    invalid: [
        // A unit contract left at the contracts/ root.
        {
            code: `import { defineContract, http } from '@jterrazz/test';\nexport default defineContract({ request: http.get('u'), response: http.json({}) });`,
            errors: [{ messageId: 'rootFile' }],
            filename: `${FEATURE}/latest.ts`,
        },
        // A facade with no default export.
        {
            code: `import { defineContracts } from '@jterrazz/test';\nconst world = defineContracts();`,
            errors: [{ messageId: 'missingComposite' }],
            filename: FACADE,
        },
        // A default export that is not a composition.
        {
            code: `export default { contracts: [] };`,
            errors: [{ messageId: 'notDefineContracts' }],
            filename: FACADE,
        },
        // A unit contract that is not kebab-case.
        {
            code: `import { defineContract, http } from '@jterrazz/test';\nexport default defineContract({ request: http.get('u'), response: http.json({}) });`,
            errors: [{ messageId: 'badName' }],
            filename: `${FEATURE}/http/Bad_Name.ts`,
        },
        // A unit contract with no default export.
        {
            code: `import { defineContract, http } from '@jterrazz/test';\nconst contract = defineContract({ request: http.get('u'), response: http.json({}) });`,
            errors: [{ messageId: 'missingDefault' }],
            filename: UNIT,
        },
        // A default export that produces no contract.
        {
            code: `export default { request: 1 };`,
            errors: [{ messageId: 'notDefineContract' }],
            filename: UNIT,
        },
        // The folder says openai, the request builder says http.
        {
            code: `import { defineContract, http } from '@jterrazz/test';\nexport default defineContract({ request: http.get('u'), response: http.json({}) });`,
            errors: [{ messageId: 'providerMismatch' }],
            filename: `${FEATURE}/openai/classify.ts`,
        },
        // Nested below the provider folder.
        {
            code: `export default 1;`,
            errors: [{ messageId: 'tooDeep' }],
            filename: `${FEATURE}/http/nested/events.ts`,
        },
        // The layout half: a stray .json at the root and a non-provider folder.
        {
            code: 'test("x", () => {});',
            errors: 2,
            filename: `${FIXTURES}/c4-contract-shape/specs/app/widget/widget.test.ts`,
        },
    ],
    valid: [
        // The canonical facade: composed default + a named scenario factory.
        {
            code: `import { defineContracts } from '@jterrazz/test';\nimport events from './http/events.js';\nimport gone from './http/article-gone.js';\nconst world = defineContracts(events);\nexport default world;\nexport const withArticleGone = (id: string) => world.with(gone(id));`,
            filename: FACADE,
        },
        // A composition re-export is a legitimate default.
        {
            code: `export { default } from './newsroom.contracts.js';`,
            filename: `${FEATURE}/pipeline.contracts.ts`,
        },
        // The canonical unit contract, matching its provider folder.
        {
            code: `import { defineContract, http } from '@jterrazz/test';\nexport default defineContract({ request: http.get('/events'), response: http.json({}) });`,
            filename: UNIT,
        },
        // A factory returning contracts is a unit too.
        {
            code: `import { defineContract, http } from '@jterrazz/test';\nexport default (id: string) => defineContract({ request: http.get('/a/' + id), response: http.error(410) });`,
            filename: `${FEATURE}/http/article-gone.ts`,
        },
        // Matched data exports a value, not a contract.
        {
            code: `export const PROMPT = 'Classify the article';`,
            filename: `${FEATURE}/openai/classify.request.ts`,
        },
        // The compliant fixture tree — the layout half stays silent.
        {
            code: 'test("x", () => {});',
            filename: `${FIXTURES}/c4-contract-shape-ok/specs/app/widget/widget.test.ts`,
        },
        // The framework's own contracts module is not a feature tree.
        {
            code: `export const x = 1;`,
            filename: '/repo/src/core/contracts/contract.ts',
        },
    ],
});
