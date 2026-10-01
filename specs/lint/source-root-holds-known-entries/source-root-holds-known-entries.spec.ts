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
                found: \`src/model/\` breaks ls-lint's \`.dir: regex:chain|clock|disk|expectations|facets|mocks|services|stubs|visitor|vitest\`
                why: The source root reads the sentence of a test: \`src/\` holds the node entry \`index.ts\`, the page entry \`index.browser.ts\`, the runner-config entry \`index.vitest.ts\`, the entries’ tests \`index.test.ts\` and \`index.vitest.test.ts\`, the type channel \`index.test-d.ts\`, and the trees of the sentence — \`facets/\`, what is tested; \`visitor/\`, how a screen is touched; \`expectations/\`, how a result is judged; \`stubs/\`, \`services/\`, \`disk/\`, \`clock/\` and \`mocks/\`, what surrounds the subject; \`chain/\`, the machinery that composes them; \`vitest/\`, the runner config — and nothing else.
                fix: move it into the tree whose concept it is — what is tested (\`facets/\`), how a screen is touched (\`visitor/\`), how a result is judged (\`expectations/\`), what surrounds the subject (\`stubs/\`, \`services/\`, \`disk/\`, \`clock/\`, \`mocks/\`), the machinery (\`chain/\`) or the runner config (\`vitest/\`)
                read: docs/03-testing.md#source-root-holds-known-entries
            src/settings.ts:1:1  names(source-root-holds-known-entries)
                found: \`src/settings.ts\` breaks ls-lint's \`.ts: regex:index\`
                why: The source root reads the sentence of a test: \`src/\` holds the node entry \`index.ts\`, the page entry \`index.browser.ts\`, the runner-config entry \`index.vitest.ts\`, the entries’ tests \`index.test.ts\` and \`index.vitest.test.ts\`, the type channel \`index.test-d.ts\`, and the trees of the sentence — \`facets/\`, what is tested; \`visitor/\`, how a screen is touched; \`expectations/\`, how a result is judged; \`stubs/\`, \`services/\`, \`disk/\`, \`clock/\` and \`mocks/\`, what surrounds the subject; \`chain/\`, the machinery that composes them; \`vitest/\`, the runner config — and nothing else.
                fix: move it into the tree whose concept it is — what is tested (\`facets/\`), how a screen is touched (\`visitor/\`), how a result is judged (\`expectations/\`), what surrounds the subject (\`stubs/\`, \`services/\`, \`disk/\`, \`clock/\`, \`mocks/\`), the machinery (\`chain/\`) or the runner config (\`vitest/\`)
                read: docs/03-testing.md#source-root-holds-known-entries
        `);
    });
});
