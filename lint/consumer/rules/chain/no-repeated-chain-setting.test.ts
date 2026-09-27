import { ruleTester } from '../../../engine/testing/rule-tester.js';
import { noRepeatedChainSetting } from './no-repeated-chain-setting.js';

const SPEC = '/repo/specs/api/events/list/pagination.spec.ts';
const IMPORT = "import { api } from '../../api.specification.js';";

ruleTester().run('no-repeated-chain-setting', noRepeatedChainSetting, {
    invalid: [
        // Every chain pins the same instant: the view is declared once, the setting leaves each chain.
        {
            code: [
                IMPORT,
                "test('a', async () => { await api.clock('2026-01-01T00:00:00Z').get('/events'); });",
                "test('b', async () => { await api.seed(file('./_seeds/x.sql')).clock('2026-01-01T00:00:00Z').get('/events?page=2'); });",
            ].join('\n'),
            errors: [{ column: 30, line: 2, messageId: 'repeated' }],
            filename: SPEC,
            output: [
                IMPORT,
                '',
                "const events = api.with({ clock: '2026-01-01T00:00:00Z' });",
                "test('a', async () => { await events.get('/events'); });",
                "test('b', async () => { await events.seed(file('./_seeds/x.sql')).get('/events?page=2'); });",
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
                    column: 30,
                    line: 2,
                    message:
                        /fix: state it once for the file — `const events = api\.with\(\{ headers: \{ 'accept-language': 'fr' \} \}\)`/u,
                },
            ],
            filename: SPEC,
            output: [
                IMPORT,
                '',
                "const events = api.with({ headers: { 'accept-language': 'fr' } });",
                "test('a', async () => { await events.get('/events'); });",
                "test('b', async () => { await events.get('/events'); });",
            ].join('\n'),
        },
        // The view is named for the subject, whatever the file's aspect: the job it triggers.
        {
            code: [
                "import { job } from '../job.specification.js';",
                "test('a', async () => { await job.clock('2026-01-01T00:00:00Z').trigger('report-refresh'); });",
                "test('b', async () => { await job.clock('2026-01-01T00:00:00Z').trigger('report-refresh'); });",
            ].join('\n'),
            errors: [{ column: 30, line: 2, messageId: 'repeated' }],
            filename: '/repo/specs/job/report-refresh/stale-reports.spec.ts',
            output: [
                "import { job } from '../job.specification.js';",
                '',
                "const reportRefresh = job.with({ clock: '2026-01-01T00:00:00Z' });",
                "test('a', async () => { await reportRefresh.trigger('report-refresh'); });",
                "test('b', async () => { await reportRefresh.trigger('report-refresh'); });",
            ].join('\n'),
        },
        // A route under an item is named for the resource its folder ends on; a name the file already holds takes `View`.
        {
            code: [
                IMPORT,
                'const chart = { symbol: "btc" };',
                "test('a', async () => { await api.clock('x').get('/indicators/:symbol/chart', { params: chart }); });",
                "test('b', async () => { await api.clock('x').get('/indicators/:symbol/chart', { params: chart }); });",
            ].join('\n'),
            errors: [{ column: 30, line: 3, messageId: 'repeated' }],
            filename: '/repo/specs/api/indicators/chart/range.spec.ts',
            output: [
                IMPORT,
                '',
                "const chartView = api.with({ clock: 'x' });",
                'const chart = { symbol: "btc" };',
                "test('a', async () => { await chartView.get('/indicators/:symbol/chart', { params: chart }); });",
                "test('b', async () => { await chartView.get('/indicators/:symbol/chart', { params: chart }); });",
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
