import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as self } from '../self-lint.specification.js';

describe('folder-named-for-a-concept', () => {
    test('concept folders of two files, and a facet root holding its face, pass', async () => {
        // Given - the concepts tree
        const result = await self.fixture(directory('./_fixtures/concepts/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a role folder, a one-file folder and a stray file at a facet root are each refused where they sit', async () => {
        // Given - the roles tree
        const result = await self.fixture(directory('./_fixtures/roles/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/clock:1:1  jterrazz-check(folder-named-for-a-concept)
                found: the folder \`clock/\` holds one entry
                why: A folder under \`src/\` is named for a concept, never a role (\`ports/\`, \`adapters/\`, \`capabilities/\`, \`actions/\`, \`results/\`, \`types/\`, \`utils/\`, \`helpers/\`, \`common/\`, \`lib/\`, \`core/\`, \`shared/\`, \`misc/\`): the role rides on the file suffix (\`*.port.ts\`, \`*.adapter.ts\`, \`*.capability.ts\` …).
                fix: fold what it holds into its parent, or give the concept the second file it groups
                read: docs/guides/test.md#folder-named-for-a-concept
            src/facets/api/route.ts:1:1  jterrazz-check(folder-named-for-a-concept)
                found: \`route.ts\` sits at the root of the facet \`api\`, and is no file of its face
                why: A folder under \`src/\` is named for a concept, never a role (\`ports/\`, \`adapters/\`, \`capabilities/\`, \`actions/\`, \`results/\`, \`types/\`, \`utils/\`, \`helpers/\`, \`common/\`, \`lib/\`, \`core/\`, \`shared/\`, \`misc/\`): the role rides on the file suffix (\`*.port.ts\`, \`*.adapter.ts\`, \`*.capability.ts\` …).
                fix: move it into the concept folder it belongs to; the root of a facet with concept folders holds its face alone — \`<facet>.face.ts\`, \`<facet>.facet.ts\`, \`<facet>.handle.ts\`, \`<facet>.project.ts\`
                read: docs/guides/test.md#folder-named-for-a-concept
            src/stubs/utils:1:1  jterrazz-check(folder-named-for-a-concept)
                found: the folder \`utils/\` is named for a role, not a concept
                why: A folder under \`src/\` is named for a concept, never a role (\`ports/\`, \`adapters/\`, \`capabilities/\`, \`actions/\`, \`results/\`, \`types/\`, \`utils/\`, \`helpers/\`, \`common/\`, \`lib/\`, \`core/\`, \`shared/\`, \`misc/\`): the role rides on the file suffix (\`*.port.ts\`, \`*.adapter.ts\`, \`*.capability.ts\` …).
                fix: name the folder for what its files are about, and let each file carry its role on its suffix (\`*.port.ts\`, \`*.adapter.ts\`, \`*.capability.ts\` …)
                read: docs/guides/test.md#folder-named-for-a-concept
        `);
    });
});
