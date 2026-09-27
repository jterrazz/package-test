import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint as self } from '../self-lint.specification.js';

describe('stubs-reached-by-their-surface', () => {
    test('a facet importing a kind and the delivery it wires, and an entry its channel pick, passes', async () => {
        // Given - the surfaced tree
        const result = await self.fixture(directory('./_fixtures/surfaced/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test("a facet reaching the matching, and a facet taking an entry's channel pick, are refused at the import", async () => {
        // Given - the reaching tree
        const result = await self.fixture(directory('./_fixtures/reaching/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/facets/api/api.facet.ts:2:1  jterrazz-check(stubs-reached-by-their-surface)
                found: \`src/world/stubs/delivery/same-process/intercept.ts\` is reached from outside the stubs, below their surface
                why: The stubs are entered by what they publish: from outside \`src/world/stubs/\`, a production module imports \`stub.ts\`, \`exchange.ts\`, a module of \`kinds/\`, or \`intercept/intercept.ts\` or \`intercept/intercept.capability.ts\` — the entries (\`index.ts\`, \`index.browser.ts\`) also the \`delivery/<channel>/intercept.ts\` their channel picks, and a facet the delivery module it wires, each edge declared in \`DELIVERY_READERS\`.
                fix: import what the stubs publish — \`stub.ts\`, \`exchange.ts\`, \`kinds/\`, \`intercept/intercept.ts\`, \`intercept/intercept.capability.ts\` — or, for a facet wiring a delivery, declare the edge in \`DELIVERY_READERS\` (\`lint/self/checks/stubs-reached-by-their-surface.ts\`)
                read: docs/03-testing.md#stubs-reached-by-their-surface
            src/facets/job/job.facet.ts:1:1  jterrazz-check(stubs-reached-by-their-surface)
                found: \`src/world/stubs/matching/stub-queue.ts\` is reached from outside the stubs, below their surface
                why: The stubs are entered by what they publish: from outside \`src/world/stubs/\`, a production module imports \`stub.ts\`, \`exchange.ts\`, a module of \`kinds/\`, or \`intercept/intercept.ts\` or \`intercept/intercept.capability.ts\` — the entries (\`index.ts\`, \`index.browser.ts\`) also the \`delivery/<channel>/intercept.ts\` their channel picks, and a facet the delivery module it wires, each edge declared in \`DELIVERY_READERS\`.
                fix: import what the stubs publish — \`stub.ts\`, \`exchange.ts\`, \`kinds/\`, \`intercept/intercept.ts\`, \`intercept/intercept.capability.ts\` — or, for a facet wiring a delivery, declare the edge in \`DELIVERY_READERS\` (\`lint/self/checks/stubs-reached-by-their-surface.ts\`)
                read: docs/03-testing.md#stubs-reached-by-their-surface
        `);
    });
});
