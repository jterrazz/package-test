import { ruleTester } from '../../../engine/testing/rule-tester.js';
import { noSimulatedDom } from './no-simulated-dom.js';
/* Joined at runtime: vitest scans a test file's SOURCE for the pragma, and a literal here would switch this file's own environment. */
const PRAGMA = ['@vitest', 'environment'].join('-');

const tester = ruleTester();

const MODULE_TEST = '/repo/src/ui/post-client.test.ts';

tester.run('no-simulated-dom', noSimulatedDom, {
    invalid: [
        {
            code: `// ${PRAGMA} happy-dom\ntest("x", () => {});`,
            errors: [{ column: 0, line: 2, messageId: 'pragma' }],
            filename: MODULE_TEST,
        },
        {
            code: `/** ${PRAGMA} jsdom */\ntest("x", () => {});`,
            errors: [{ column: 0, line: 2, messageId: 'pragma' }],
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
