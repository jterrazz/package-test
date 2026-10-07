import { ruleTester } from '@jterrazz/test';

import { stubsImportedThroughFacade } from '../stubs-imported-through-facade.js';

const TEST_FILE = '/repo/specs/api/feature/feature.test.ts';

ruleTester().run('stubs-imported-through-facade', stubsImportedThroughFacade, {
    invalid: [
        {
            name: 'A test reaching into a kind folder.',
            code: `import events from './stubs/http/events.js';`,
            errors: [{ column: 19, line: 1, messageId: 'internal' }],
            filename: TEST_FILE,
        },
        {
            name: 'Same through a re-export, from a neighbouring feature.',
            code: `export { default } from '../../pipeline/stubs/openai/classify.js';`,
            errors: [{ column: 24, line: 1, messageId: 'internal' }],
            filename: TEST_FILE,
        },
        {
            name: 'And from a specification file.',
            code: `import gone from './articles/stubs/anthropic/draft.js';`,
            errors: [{ column: 17, line: 1, messageId: 'internal' }],
            filename: '/repo/specs/api/api.specification.ts',
        },
    ],
    valid: [
        {
            name: 'Outside specs/, and inside a stubs folder, the units are no facade’s to hide.',
            code: `import events from './stubs/http/events.js';`,
            filename: '/repo/src/home.ts',
        },
        {
            code: `import events from '../stubs/http/events.js';`,
            filename: '/repo/specs/api/feature/__setup__/stubs/news.stubs.ts',
        },
        {
            name: 'The facade is the public surface.',
            code: `import world from './stubs/newsroom.stubs.js';`,
            filename: TEST_FILE,
        },
        {
            name: "Inside stubs/, the internal half is the file's own business.",
            code: `import events from './http/events.js';`,
            filename: '/repo/specs/api/feature/stubs/newsroom.stubs.ts',
        },
        {
            name: 'A unit importing its neighbour stays internal too.',
            code: `import payload from '../../http/events.response.json' with { type: 'json' };`,
            filename: '/repo/specs/api/feature/stubs/openai/classify.ts',
        },
        {
            name: 'Outside specs/ the rule is inert.',
            code: `import events from './stubs/http/events.js';`,
            filename: '/repo/src/specification/stubs/queue.ts',
        },
    ],
});
