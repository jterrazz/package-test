import { asOxlintRule, ruleTester } from '../rule-tester.fixtures.js';
import { e6ComponentProjectHelper } from './e6-component-project-helper.js';

const tester = ruleTester();

const CONFIG = '/repo/vitest.config.ts';

tester.run('e6-component-project-helper', asOxlintRule(e6ComponentProjectHelper), {
    invalid: [
        {
            code: 'export default { test: { browser: { enabled: true, instances: [] } } };',
            errors: [{ messageId: 'handRolled' }],
            filename: CONFIG,
        },
        {
            code: 'export default { test: { projects: [{ test: { browser: { enabled: true } } }] } };',
            errors: [{ messageId: 'handRolled' }],
            filename: CONFIG,
        },
    ],
    valid: [
        // What the helper builds is the helper's, however deep the block sits.
        {
            code: 'export default { test: { projects: [component({ browser: { headless: false } })] } };',
            filename: CONFIG,
        },
        // A node project states no browser at all.
        { code: 'export default { test: { projects: [unit()] } };', filename: CONFIG },
        // The word means something else outside a vitest config.
        { code: 'export const ua = { browser: "chromium" };', filename: '/repo/src/ua.ts' },
    ],
});
