import { asOxlintRule, ruleTester } from '../rule-tester.fixtures.js';
import { e4wProjectBinding } from './e4w-project-binding.js';

const CONFIG = '/repo/vitest.config.ts';

ruleTester().run('e4w-project-binding', asOxlintRule(e4wProjectBinding), {
    invalid: [
        // A facet root under another name.
        {
            code: `export default defineSpecConfig({ test: { projects: [{ name: 'http', include: ['specs/api/**/*.spec.ts'] }] } });`,
            errors: [{ messageId: 'nameTheFacet' }],
            filename: CONFIG,
        },
        // A facet name over another root.
        {
            code: `export default defineSpecConfig({ test: { projects: [{ name: 'api', include: ['src/**/*.test.ts'] }] } });`,
            errors: [{ messageId: 'rootTheFacet' }],
            filename: CONFIG,
        },
        // `unit` reaching inside a specs tree.
        {
            code: `export default defineSpecConfig({ test: { projects: [{ name: 'unit', include: ['specs/build/**/*.test.ts'] }] } });`,
            errors: [{ messageId: 'unitOutsideSpecs' }],
            filename: CONFIG,
        },
    ],
    valid: [
        // The binding stated both ways.
        {
            code: `export default defineSpecConfig({ test: { projects: [{ name: 'website', include: ['specs/website/**/*.spec.ts'] }] } });`,
            filename: CONFIG,
        },
        // A repository suite names its project as it likes.
        {
            code: `export default defineSpecConfig({ test: { projects: [{ name: 'corpus', include: ['specs/corpus/**/*.test.ts'] }] } });`,
            filename: CONFIG,
        },
        // `unit` where it belongs.
        {
            code: `export default defineSpecConfig({ test: { projects: [{ name: 'unit', include: ['src/**/*.test.ts'] }] } });`,
            filename: CONFIG,
        },
        // A project with no name is the helper's business, not this rule's.
        {
            code: `export default defineSpecConfig({ test: { projects: [{ include: ['specs/api/**/*.spec.ts'] }] } });`,
            filename: CONFIG,
        },
    ],
});
