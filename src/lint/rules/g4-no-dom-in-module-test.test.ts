import { asOxlintRule, ruleTester } from '../rule-tester.fixtures.js';
import { g4NoDomInModuleTest } from './g4-no-dom-in-module-test.js';

const tester = ruleTester();

const MODULE_TEST = '/repo/src/ui/post-client.test.ts';
const COMPONENT_TEST = '/repo/src/ui/post-table.test.tsx';

tester.run('g4-no-dom-in-module-test', asOxlintRule(g4NoDomInModuleTest), {
    invalid: [
        {
            code: 'test("x", () => { document.createElement("div"); });',
            errors: [{ messageId: 'domGlobal' }],
            filename: MODULE_TEST,
        },
        {
            code: 'test("x", () => { window.location.href; });',
            errors: [{ messageId: 'domGlobal' }],
            filename: MODULE_TEST,
        },
        {
            code: 'test("x", () => { const node: HTMLElement = build(); });',
            errors: [{ messageId: 'domGlobal' }],
            filename: MODULE_TEST,
        },
        {
            code: 'test("x", () => { navigator.userAgent; });',
            errors: [{ messageId: 'domGlobal' }],
            filename: MODULE_TEST,
        },
    ],
    valid: [
        // A rendered unit IS the kind that has a document.
        { code: 'test("x", () => { document.body.append(node); });', filename: COMPONENT_TEST },
        // A property is not a global.
        { code: 'test("x", () => { capture.window; });', filename: MODULE_TEST },
        // A binding of that name is the test's own.
        { code: 'test("x", () => { const document = parse(html); });', filename: MODULE_TEST },
        // Production code is F2/I4's, never G4's.
        { code: 'document.title;', filename: '/repo/src/ui/post-client.ts' },
    ],
});
