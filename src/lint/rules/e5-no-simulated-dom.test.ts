import { asOxlintRule, ruleTester } from '../rule-tester.fixtures.js';
import { e5NoSimulatedDom } from './e5-no-simulated-dom.js';

const tester = ruleTester();

const MODULE_TEST = '/repo/src/ui/post-client.test.ts';

tester.run('e5-no-simulated-dom', asOxlintRule(e5NoSimulatedDom), {
    invalid: [
        {
            code: '// @vitest-environment happy-dom\ntest("x", () => {});',
            errors: [{ messageId: 'pragma' }],
            filename: MODULE_TEST,
        },
        {
            code: '/** @vitest-environment jsdom */\ntest("x", () => {});',
            errors: [{ messageId: 'pragma' }],
            filename: MODULE_TEST,
        },
    ],
    valid: [
        // A real runtime is not a drawing of one.
        { code: '// @vitest-environment node\ntest("x", () => {});', filename: MODULE_TEST },
        {
            code: '// @vitest-environment edge-runtime\ntest("x", () => {});',
            filename: MODULE_TEST,
        },
        // Production code carries no environment pragma to judge.
        {
            code: '// @vitest-environment happy-dom\nexport const x = 1;',
            filename: '/repo/src/ui/post-client.ts',
        },
    ],
});
