import { asOxlintRule, ruleTester } from '../rule-tester.fixtures.js';
import { e5NoSimulatedDom } from './e5-no-simulated-dom.js';
/* Joined at runtime: vitest scans a test file's SOURCE for the pragma, and a literal here would switch this file's own environment. */
const PRAGMA = ['@vitest', 'environment'].join('-');

const tester = ruleTester();

const MODULE_TEST = '/repo/src/ui/post-client.test.ts';

tester.run('e5-no-simulated-dom', asOxlintRule(e5NoSimulatedDom), {
    invalid: [
        {
            code: `// ${PRAGMA} happy-dom\ntest("x", () => {});`,
            errors: [{ messageId: 'pragma' }],
            filename: MODULE_TEST,
        },
        {
            code: `/** ${PRAGMA} jsdom */\ntest("x", () => {});`,
            errors: [{ messageId: 'pragma' }],
            filename: MODULE_TEST,
        },
    ],
    valid: [
        // A real runtime is not a drawing of one.
        { code: `// ${PRAGMA} node\ntest("x", () => {});`, filename: MODULE_TEST },
        {
            code: `// ${PRAGMA} edge-runtime\ntest("x", () => {});`,
            filename: MODULE_TEST,
        },
        // Production code carries no environment pragma to judge.
        {
            code: `// ${PRAGMA} happy-dom\nexport const x = 1;`,
            filename: '/repo/src/ui/post-client.ts',
        },
    ],
});
