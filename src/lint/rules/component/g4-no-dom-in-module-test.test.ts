import { asOxlintRule, ruleTester } from '../../rule-tester.fixtures.js';
import { g4NoDomInModuleTest } from './g4-no-dom-in-module-test.js';

const tester = ruleTester();

const MODULE_TEST = '/repo/src/ui/post-client.test.ts';
const COMPONENT_TEST = '/repo/src/ui/post-table.test.tsx';
const PRODUCT_SPEC = '/repo/specs/website/home/page.test.ts';

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
            code: 'test("x", () => { navigator.userAgent; });',
            errors: [{ messageId: 'domGlobal' }],
            filename: MODULE_TEST,
        },
    ],
    valid: [
        // A type names no document — nothing is reached, nothing is rendered.
        { code: 'test("x", () => { const node: HTMLElement = build(); });', filename: MODULE_TEST },
        { code: 'test("x", () => { ({}) as unknown as HTMLElement; });', filename: MODULE_TEST },
        // The guard a module that must run in both runtimes is TESTED by.
        {
            code: 'test("x", () => { expect(typeof window).toBe("undefined"); });',
            filename: MODULE_TEST,
        },
        // Under specs/ a `.test.ts` is a product spec until the `spec` role
        // Exists; the guard stops at the tree it can judge.
        { code: 'test("x", () => { document.title; });', filename: PRODUCT_SPEC },
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
