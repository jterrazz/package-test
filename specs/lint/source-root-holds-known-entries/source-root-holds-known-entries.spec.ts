import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint as selfPreset } from '../self-preset-lint.specification.js';

describe('source-root-holds-known-entries', () => {
    test('the source root holding the entry and a tree passes', async () => {
        // Given - the rooted tree
        const result = await selfPreset.fixture(directory('./_fixtures/rooted/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a module and a folder left at the source root are each refused at the entry', async () => {
        // Given - the stray tree
        const result = await selfPreset.fixture(directory('./_fixtures/stray/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/model/:1:1  names(source-root-holds-known-entries)
                found: \`src/model/\` breaks ls-lint's \`.dir: regex:elements|expectations|facets|kernel|vitest|world\`
                why: The source root reads the sentence of a test: \`src/\` holds the node entry \`index.ts\`, the page entry \`index.browser.ts\`, the runner-config entry \`index.vitest.ts\`, the entries’ tests \`index.test.ts\` and \`index.vitest.test.ts\`, the type channel \`index.test-d.ts\`, and the six trees — \`kernel/\`, \`world/\`, \`elements/\`, \`expectations/\`, \`facets/\`, \`vitest/\` — and nothing else.
                fix: move it into the tree whose concept it is — what is tested (\`facets/\`), what surrounds it (\`world/\`), how a screen is touched (\`elements/\`), how a result is judged (\`expectations/\`), the machinery (\`kernel/\`) or the runner config (\`vitest/\`)
                read: docs/03-testing.md#source-root-holds-known-entries
            src/settings.ts:1:1  names(source-root-holds-known-entries)
                found: \`src/settings.ts\` breaks ls-lint's \`.ts: regex:index\`
                why: The source root reads the sentence of a test: \`src/\` holds the node entry \`index.ts\`, the page entry \`index.browser.ts\`, the runner-config entry \`index.vitest.ts\`, the entries’ tests \`index.test.ts\` and \`index.vitest.test.ts\`, the type channel \`index.test-d.ts\`, and the six trees — \`kernel/\`, \`world/\`, \`elements/\`, \`expectations/\`, \`facets/\`, \`vitest/\` — and nothing else.
                fix: move it into the tree whose concept it is — what is tested (\`facets/\`), what surrounds it (\`world/\`), how a screen is touched (\`elements/\`), how a result is judged (\`expectations/\`), the machinery (\`kernel/\`) or the runner config (\`vitest/\`)
                read: docs/03-testing.md#source-root-holds-known-entries
        `);
    });
});
