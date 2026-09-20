import { resolve } from 'node:path';

import { asOxlintRule, ruleTester } from '../../rule-tester.fixtures.js';
import { e4wProjectBinding } from './e4w-project-binding.js';

const CONFIG = '/repo/vitest.config.ts';

/**
 * A real config in a real package whose ABSOLUTE path carries a `specs`
 * segment above it — the shape a checkout under `~/specs/` has, read here from
 * a fixture that exists on disk so the package boundary is a fact and not a
 * string.
 */
const UNDER_A_SPECS_PATH = resolve(
    import.meta.dirname,
    '../../../../specs/_fixtures/lint-violations/e4w-project-binding-ok/vitest.config.ts',
);

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
        // A checkout that lives under a folder called `specs`: the package
        // Root bounds the search, so `unit` collects its own `src/`.
        {
            code: `export default defineSpecConfig({ test: { projects: [{ name: 'unit', include: ['src/**/*.test.ts'] }] } });`,
            filename: UNDER_A_SPECS_PATH,
        },
        // An option spelled `include` that is not a project's — package
        // Specifiers, never a tree.
        {
            code: `export default defineSpecConfig({ optimizeDeps: { include: ['react-dom/client'] }, test: { projects: [{ name: 'api', include: ['specs/api/**/*.spec.ts'] }] } });`,
            filename: CONFIG,
        },
        // A project with no name is the helper's business, not this rule's.
        {
            code: `export default defineSpecConfig({ test: { projects: [{ include: ['specs/api/**/*.spec.ts'] }] } });`,
            filename: CONFIG,
        },
    ],
});
