import { asOxlintRule, ruleTester } from '../../rule-tester.fixtures.js';
import { b16wFileContext } from './b16w-file-context.js';

const SPEC = '/repo/specs/api/events/list/pagination.spec.ts';
const IMPORT = "import { api } from '../../api.specification.js';";

ruleTester().run('b16w-file-context', asOxlintRule(b16wFileContext), {
    invalid: [
        // Every chain pins the same instant: the view is declared once, the setting leaves each chain.
        {
            code: [
                IMPORT,
                "test('a', async () => { await api.clock('2026-01-01T00:00:00Z').get('/events'); });",
                "test('b', async () => { await api.seed(sql`x`).clock('2026-01-01T00:00:00Z').get('/events?page=2'); });",
            ].join('\n'),
            errors: [{ messageId: 'repeated' }],
            filename: SPEC,
            output: [
                IMPORT,
                '',
                "const pagination = api.with({ clock: '2026-01-01T00:00:00Z' });",
                "test('a', async () => { await pagination.get('/events'); });",
                "test('b', async () => { await pagination.seed(sql`x`).get('/events?page=2'); });",
            ].join('\n'),
        },
        // The message spells the view it would write.
        {
            code: [
                IMPORT,
                "test('a', async () => { await api.headers({ 'accept-language': 'fr' }).get('/events'); });",
                "test('b', async () => { await api.headers({ 'accept-language': 'fr' }).get('/events'); });",
            ].join('\n'),
            errors: [
                {
                    message:
                        /fix: state it once for the file — `const pagination = api\.with\(\{ headers: \{ 'accept-language': 'fr' \} \}\)`/u,
                },
            ],
            filename: SPEC,
            output: [
                IMPORT,
                '',
                "const pagination = api.with({ headers: { 'accept-language': 'fr' } });",
                "test('a', async () => { await pagination.get('/events'); });",
                "test('b', async () => { await pagination.get('/events'); });",
            ].join('\n'),
        },
    ],
    valid: [
        // One chain states nothing about a file.
        {
            code: `${IMPORT}\ntest('a', async () => { await api.clock('x').get('/events'); });`,
            filename: SPEC,
        },
        // Two instants are two conditions.
        {
            code: `${IMPORT}\ntest('a', async () => { await api.clock('x').get('/e'); });\ntest('b', async () => { await api.clock('y').get('/e'); });`,
            filename: SPEC,
        },
        // A chain without the setting breaks the pattern.
        {
            code: `${IMPORT}\ntest('a', async () => { await api.clock('x').get('/e'); });\ntest('b', async () => { await api.get('/e'); });`,
            filename: SPEC,
        },
        // A seed repeated is a Given, never a setting.
        {
            code: `${IMPORT}\ntest('a', async () => { await api.seed(S).get('/e'); });\ntest('b', async () => { await api.seed(S).get('/e'); });`,
            filename: SPEC,
        },
        // A module test is not a spec.
        {
            code: `${IMPORT}\ntest('a', async () => { await api.clock('x').get('/e'); });\ntest('b', async () => { await api.clock('x').get('/e'); });`,
            filename: '/repo/src/events.test.ts',
        },
    ],
});
