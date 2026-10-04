import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as self } from '../self-lint.specification.js';

describe('specimen-filed-by-capability', () => {
    test('a spec of a specimen filed under a capability of the matrix passes, whatever route it reaches', async () => {
        // Given - the filed tree
        const result = await self.fixture(directory('./_fixtures/filed/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test("a unit and its test at the component tree's root, outside every capability, are refused", async () => {
        // Given - the unfiled-component tree
        const result = await self.fixture(directory('./_fixtures/unfiled-component/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/component/order-card.test.tsx:1:1  jterrazz-check(specimen-filed-by-capability)
                found: a file of the component tree, filed under \`component/\`
                why: A spec of a SPECIMEN, and every file of the component tree, is filed by the capability it specifies.
                fix: file it under the capability it specifies, one folder below its facet — \`component/<capability>/<unit>.test.tsx\` beside the \`<unit>.tsx\` it renders, the capability a name the matrix gives the \`component\` column, kebab-cased (\`intercept\`, \`clock\`, \`to-match\`, …; docs/guides/test.md § The capability matrix)
                read: docs/guides/test.md#specimen-filed-by-capability
            specs/component/order-card.tsx:2:1  jterrazz-check(specimen-filed-by-capability)
                found: a file of the component tree, filed under \`component/\`
                why: A spec of a SPECIMEN, and every file of the component tree, is filed by the capability it specifies.
                fix: file it under the capability it specifies, one folder below its facet — \`component/<capability>/<unit>.test.tsx\` beside the \`<unit>.tsx\` it renders, the capability a name the matrix gives the \`component\` column, kebab-cased (\`intercept\`, \`clock\`, \`to-match\`, …; docs/guides/test.md § The capability matrix)
                read: docs/guides/test.md#specimen-filed-by-capability
        `);
    });

    test('a spec of a specimen filed by the route it reaches is refused at its first line', async () => {
        // Given - the misfiled tree
        const result = await self.fixture(directory('./_fixtures/misfiled/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/orders/list/listing.spec.ts:1:1  jterrazz-check(specimen-filed-by-capability)
                found: a spec of the specimen \`specimen-api\`, filed under \`api/orders/list/\`
                why: A spec of a SPECIMEN, and every file of the component tree, is filed by the capability it specifies.
                fix: file it under the capability it specifies, one folder below its facet — \`api/<capability>/<aspect>.spec.ts\`, the capability a name the matrix gives the \`api\` column, kebab-cased (\`seed\`, \`intercept\`, \`clock\`, \`to-match\`, \`get\`, …; docs/guides/test.md § The capability matrix)
                read: docs/guides/test.md#specimen-filed-by-capability
        `);
    });
});
