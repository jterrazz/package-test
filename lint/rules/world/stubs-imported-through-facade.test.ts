import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { c10StubsBoundary } from './stubs-imported-through-facade.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const TEST_FILE = '/repo/specs/api/feature/feature.test.ts';

ruleTester.run('c10-stubs-boundary', c10StubsBoundary as unknown as OxlintRule, {
    invalid: [
        // A test reaching into a kind folder.
        {
            code: `import events from './stubs/http/events.js';`,
            errors: [{ messageId: 'internal' }],
            filename: TEST_FILE,
        },
        // Same through a re-export, from a neighbouring feature.
        {
            code: `export { default } from '../../pipeline/stubs/openai/classify.js';`,
            errors: [{ messageId: 'internal' }],
            filename: TEST_FILE,
        },
        // And from a specification file.
        {
            code: `import gone from './articles/stubs/anthropic/draft.js';`,
            errors: [{ messageId: 'internal' }],
            filename: '/repo/specs/api/api.specification.ts',
        },
    ],
    valid: [
        // The facade is the public surface.
        {
            code: `import world from './stubs/newsroom.stubs.js';`,
            filename: TEST_FILE,
        },
        // Inside stubs/, the internal half is the file's own business.
        {
            code: `import events from './http/events.js';`,
            filename: '/repo/specs/api/feature/stubs/newsroom.stubs.ts',
        },
        // A unit importing its neighbour stays internal too.
        {
            code: `import payload from '../../http/events.response.json' with { type: 'json' };`,
            filename: '/repo/specs/api/feature/stubs/openai/classify.ts',
        },
        // Outside specs/ the rule is inert.
        {
            code: `import events from './stubs/http/events.js';`,
            filename: '/repo/src/specification/stubs/queue.ts',
        },
    ],
});
