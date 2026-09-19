import { asOxlintRule, ruleTester } from '../rule-tester.fixtures.js';
import { e5bNoSimulatedDomConfig } from './e5b-no-simulated-dom-config.js';

const tester = ruleTester();

const CONFIG = '/repo/vitest.config.ts';

tester.run('e5b-no-simulated-dom-config', asOxlintRule(e5bNoSimulatedDomConfig), {
    invalid: [
        {
            code: 'export default { test: { environment: "happy-dom" } };',
            errors: [{ messageId: 'configured' }],
            filename: CONFIG,
        },
        {
            code: 'export default { test: { projects: [{ test: { environment: "jsdom" } }] } };',
            errors: [{ messageId: 'configured' }],
            filename: CONFIG,
        },
    ],
    valid: [
        // A real runtime is out of reach.
        { code: 'export default { test: { environment: "node" } };', filename: CONFIG },
        { code: 'export default { test: { environment: "edge-runtime" } };', filename: CONFIG },
        // The word means something else outside a vitest config.
        {
            code: 'export const settings = { environment: "jsdom" };',
            filename: '/repo/src/settings.ts',
        },
    ],
});
