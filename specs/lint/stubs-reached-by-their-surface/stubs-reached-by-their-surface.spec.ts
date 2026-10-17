import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as self } from '../self-lint.specification.js';

describe('stubs-reached-by-their-surface', () => {
    test('a specification importing a kind and the delivery it wires, and an entry its channel pick, pass, and so do a module test, its ground and a script reaching below the surface', async () => {
        // Given - the surfaced tree, whose module test, the ground it stands on and a `.mjs` script import the stub queue: none is a production module
        const result = await self.fixture(directory('./__fixtures__/surfaced/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test("a specification reaching the matching, and a specification taking an entry's channel pick, are refused at the import", async () => {
        // Given - the reaching tree
        const result = await self.fixture(directory('./__fixtures__/reaching/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/specifications/api/api.composition.ts:2:1  jterrazz-check(stubs-reached-by-their-surface)
                found: \`src/stubs/delivery/same-process/intercept.ts\` is reached from outside the stubs, below their surface
                why: The stubs are entered by what they publish: from outside \`src/stubs/\`, a production module imports \`stub.ts\`, \`exchange.ts\`, a module of \`kinds/\`, or \`intercept/intercept.ts\` or \`intercept/intercept.capability.ts\`.
                fix: import what the stubs publish (\`stub.ts\`, \`exchange.ts\`, \`kinds/\`, \`intercept/intercept.ts\`, \`intercept/intercept.capability.ts\`) or, for a specification wiring a delivery, declare the edge in \`DELIVERY_READERS\` (\`lint/self/checks/stubs-reached-by-their-surface.ts\`)
                read: docs/guides/test.md#stubs-reached-by-their-surface
            src/specifications/job/job.composition.ts:1:1  jterrazz-check(stubs-reached-by-their-surface)
                found: \`src/stubs/matching/stub-queue.ts\` is reached from outside the stubs, below their surface
                why: The stubs are entered by what they publish: from outside \`src/stubs/\`, a production module imports \`stub.ts\`, \`exchange.ts\`, a module of \`kinds/\`, or \`intercept/intercept.ts\` or \`intercept/intercept.capability.ts\`.
                fix: import what the stubs publish (\`stub.ts\`, \`exchange.ts\`, \`kinds/\`, \`intercept/intercept.ts\`, \`intercept/intercept.capability.ts\`) or, for a specification wiring a delivery, declare the edge in \`DELIVERY_READERS\` (\`lint/self/checks/stubs-reached-by-their-surface.ts\`)
                read: docs/guides/test.md#stubs-reached-by-their-surface
        `);
    });
});
