import { ruleTester } from '@jterrazz/test';

import { noDomInModuleTest } from './no-dom-in-module-test.js';

const tester = ruleTester();

const MODULE_TEST = '/repo/src/ui/post-client.test.ts';
const COMPONENT_TEST = '/repo/src/ui/post-table.test.tsx';
const PRODUCT_SPEC = '/repo/specs/website/home/page.test.ts';

tester.run('no-dom-in-module-test', noDomInModuleTest, {
    invalid: [
        {
            name: 'Negated or read by a computed key, the global is still reached.',
            code: 'test("x", () => { if (!window) {} capture[document]; ({ a: navigator, [window]: 1 }); });',
            errors: [
                { column: 23, line: 1, messageId: 'domGlobal' },
                { column: 42, line: 1, messageId: 'domGlobal' },
                { column: 59, line: 1, messageId: 'domGlobal' },
                { column: 71, line: 1, messageId: 'domGlobal' },
            ],
            filename: MODULE_TEST,
        },
        {
            code: 'test("x", () => { document.createElement("div"); });',
            errors: [{ column: 18, line: 1, messageId: 'domGlobal' }],
            filename: MODULE_TEST,
        },
        {
            code: 'test("x", () => { window.location.href; });',
            errors: [{ column: 18, line: 1, messageId: 'domGlobal' }],
            filename: MODULE_TEST,
        },
        {
            code: 'test("x", () => { navigator.userAgent; });',
            errors: [{ column: 18, line: 1, messageId: 'domGlobal' }],
            filename: MODULE_TEST,
        },
    ],
    valid: [
        {
            name: 'A parameter of that name is the test’s own, and a key of that name reaches nothing.',
            code: 'test("x", () => { const read = (document) => document.title; const keys = { navigator: 1 }; });',
            filename: MODULE_TEST,
        },
        {
            name: 'A type names no document — nothing is reached, nothing is rendered.',
            code: 'test("x", () => { const node: HTMLElement = build(); });',
            filename: MODULE_TEST,
        },
        { code: 'test("x", () => { ({}) as unknown as HTMLElement; });', filename: MODULE_TEST },
        {
            name: 'The guard a module that must run in both runtimes is TESTED by.',
            code: 'test("x", () => { expect(typeof window).toBe("undefined"); });',
            filename: MODULE_TEST,
        },
        {
            name: 'Under specs/ a `.test.ts` is a product spec until the `spec` role exists; the guard stops at the tree it can judge.',
            code: 'test("x", () => { document.title; });',
            filename: PRODUCT_SPEC,
        },
        {
            name: 'A rendered unit IS the kind that has a document.',
            code: 'test("x", () => { document.body.append(node); });',
            filename: COMPONENT_TEST,
        },
        {
            name: 'A property is not a global.',
            code: 'test("x", () => { capture.window; });',
            filename: MODULE_TEST,
        },
        {
            name: "A binding of that name is the test's own.",
            code: 'test("x", () => { const document = parse(html); });',
            filename: MODULE_TEST,
        },
        {
            name: 'Production code is for `no-test-code-in-production` and `no-module-mock`, never `no-dom-in-module-test`.',
            code: 'document.title;',
            filename: '/repo/src/ui/post-client.ts',
        },
    ],
});
