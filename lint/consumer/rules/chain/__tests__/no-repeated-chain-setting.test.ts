import { ruleTester } from '@jterrazz/test';

import { noRepeatedChainSetting } from '../no-repeated-chain-setting.js';

const SPEC = '/repo/specs/api/events/list/pagination.spec.ts';
const IMPORT = "import { api } from '../../api.specification.js';";

ruleTester().run('no-repeated-chain-setting', noRepeatedChainSetting, {
    invalid: [
        {
            name: 'Every chain pins the same instant: the view is declared once, the setting leaves each chain.',
            code: [
                IMPORT,
                "test('a', async () => { await api.clock('2026-01-01T00:00:00Z').get('/events'); });",
                "test('b', async () => { await api.seed(file('./__seeds__/x.sql')).clock('2026-01-01T00:00:00Z').get('/events?page=2'); });",
            ].join('\n'),
            errors: [{ column: 30, line: 2, messageId: 'repeated' }],
            filename: SPEC,
            output: [
                IMPORT,
                '',
                "const events = api.with({ clock: '2026-01-01T00:00:00Z' });",
                "test('a', async () => { await events.get('/events'); });",
                "test('b', async () => { await events.seed(file('./__seeds__/x.sql')).get('/events?page=2'); });",
            ].join('\n'),
        },
        {
            name: 'A setting that reads a constant of the file is declared after it, never above it.',
            code: [
                "import { job } from '../job.specification.js';",
                '',
                "const SNAPSHOT_AT = '2026-03-10T12:00:00.000Z';",
                'const OTHER = 1;',
                "test('a', async () => { await job.clock(SNAPSHOT_AT).trigger('ticker-snapshot'); });",
                "test('b', async () => { await job.clock(SNAPSHOT_AT).trigger('ticker-snapshot'); });",
            ].join('\n'),
            errors: [{ column: 30, line: 5, messageId: 'repeated' }],
            filename: '/repo/specs/job/ticker-snapshot/snapshot.spec.ts',
            output: [
                "import { job } from '../job.specification.js';",
                '',
                "const SNAPSHOT_AT = '2026-03-10T12:00:00.000Z';",
                '',
                'const tickerSnapshot = job.with({ clock: SNAPSHOT_AT });',
                'const OTHER = 1;',
                "test('a', async () => { await tickerSnapshot.trigger('ticker-snapshot'); });",
                "test('b', async () => { await tickerSnapshot.trigger('ticker-snapshot'); });",
            ].join('\n'),
        },
        {
            name: 'An exported constant a setting reads counts as one, and a function or a bare export declared after it does not move the view.',
            code: [
                "import { job } from '../job.specification.js';",
                "export const AT = '2026-03-10T12:00:00.000Z';",
                'function helper() {}',
                'export {};',
                "test('a', async () => { await job.clock(AT).trigger('ticker-snapshot'); });",
                "test('b', async () => { await job.clock(AT).trigger('ticker-snapshot'); });",
            ].join('\n'),
            errors: [{ column: 30, line: 5, messageId: 'repeated' }],
            filename: '/repo/specs/job/ticker-snapshot/snapshot.spec.ts',
            output: [
                "import { job } from '../job.specification.js';",
                "export const AT = '2026-03-10T12:00:00.000Z';",
                '',
                'const tickerSnapshot = job.with({ clock: AT });',
                'function helper() {}',
                'export {};',
                "test('a', async () => { await tickerSnapshot.trigger('ticker-snapshot'); });",
                "test('b', async () => { await tickerSnapshot.trigger('ticker-snapshot'); });",
            ].join('\n'),
        },
        {
            name: "The view is named for the subject, whatever the file's aspect: the job it triggers.",
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
        {
            name: 'A route under an item is named for the resource its folder ends on; a name the file already holds takes `View`.',
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
        {
            name: 'Only what every chain states leaves them; the message counts the chains and names the first shared setting.',
            code: [
                IMPORT,
                "test('a', async () => { await api.clock('x').headers(H).get('/e'); });",
                "test('b', async () => { await api.clock('x').headers(H).get('/e'); });",
                "test('c', async () => { await api.clock('x').headers(G).get('/e'); });",
            ].join('\n'),
            errors: [
                {
                    column: 30,
                    line: 2,
                    message: /^found: all 3 chains of this file state `\.clock\('x'\)` alike · /u,
                },
            ],
            filename: SPEC,
            output: [
                IMPORT,
                '',
                "const e = api.with({ clock: 'x' });",
                "test('a', async () => { await e.headers(H).get('/e'); });",
                "test('b', async () => { await e.headers(H).get('/e'); });",
                "test('c', async () => { await e.headers(G).get('/e'); });",
            ].join('\n'),
        },
        {
            name: 'A cli view is named for the command it runs.',
            code: [
                "import { cli } from '../cli.specification';",
                "test('a', async () => { await cli.env({ CI: '1' }).exec('build'); });",
                "test('b', async () => { await cli.env({ CI: '1' }).exec('build --watch'); });",
            ].join('\n'),
            errors: [{ column: 30, line: 2, messageId: 'repeated' }],
            filename: '/repo/specs/cli/build/watch.spec.ts',
            output: [
                "import { cli } from '../cli.specification';",
                '',
                "const build = cli.with({ env: { CI: '1' } });",
                "test('a', async () => { await build.exec('build'); });",
                "test('b', async () => { await build.exec('build --watch'); });",
            ].join('\n'),
        },
        {
            name: 'A subject named like the handle, or no word a name can start with, takes `View`; no subject at all takes `InFile`.',
            code: [
                "import { api, integration } from '../../integration.specification.ts';",
                "test('a', async () => { await integration.clock('x').call(f); });",
                "test('b', async () => { await integration.clock('x').call(f); });",
            ].join('\n'),
            errors: [{ column: 30, line: 2, messageId: 'repeated' }],
            filename: '/repo/specs/integration/orders/flow.spec.ts',
            output: [
                "import { api, integration } from '../../integration.specification.ts';",
                '',
                "const integrationInFile = integration.with({ clock: 'x' });",
                "test('a', async () => { await integrationInFile.call(f); });",
                "test('b', async () => { await integrationInFile.call(f); });",
            ].join('\n'),
        },
        {
            name: 'A subject folder named like the handle takes `View`.',
            code: [
                IMPORT,
                "test('a', async () => { await api.clock('x').get('/api'); });",
                "test('b', async () => { await api.clock('x').get('/api'); });",
            ].join('\n'),
            errors: [{ column: 30, line: 2, messageId: 'repeated' }],
            filename: '/repo/specs/api/api/get/x.spec.ts',
            output: [
                IMPORT,
                '',
                "const apiView = api.with({ clock: 'x' });",
                "test('a', async () => { await apiView.get('/api'); });",
                "test('b', async () => { await apiView.get('/api'); });",
            ].join('\n'),
        },
        {
            name: 'A subject word no name can start with leaves the view named for the file.',
            code: [
                "import { job } from '../job.specification.js';",
                "test('a', async () => { await job.clock('x').trigger('2fa-sync'); });",
                "test('b', async () => { await job.clock('x').trigger('2fa-sync'); });",
            ].join('\n'),
            errors: [{ column: 30, line: 2, messageId: 'repeated' }],
            filename: '/repo/specs/job/2fa-sync/x.spec.ts',
            output: [
                "import { job } from '../job.specification.js';",
                '',
                "const jobInFile = job.with({ clock: 'x' });",
                "test('a', async () => { await jobInFile.trigger('2fa-sync'); });",
                "test('b', async () => { await jobInFile.trigger('2fa-sync'); });",
            ].join('\n'),
        },
        {
            name: 'Two settings every chain states leave together, and one only some state stays where it is.',
            code: [
                IMPORT,
                "test('a', async () => { await api.clock('x').headers(H).env(E).get('/e'); });",
                "test('b', async () => { await api.clock('x').headers(H).get('/e'); });",
            ].join('\n'),
            errors: [
                {
                    column: 30,
                    line: 2,
                    message: /`const e = api\.with\(\{ clock: 'x', headers: H \}\)`/u,
                },
            ],
            filename: SPEC,
            output: [
                IMPORT,
                '',
                "const e = api.with({ clock: 'x', headers: H });",
                "test('a', async () => { await e.env(E).get('/e'); });",
                "test('b', async () => { await e.get('/e'); });",
            ].join('\n'),
        },
        {
            name: 'A setting another shares its argument with is no shared one.',
            code: [
                IMPORT,
                "test('a', async () => { await api.clock(X).headers(X).get('/e'); });",
                "test('b', async () => { await api.clock(X).headers(Y).get('/e'); });",
            ].join('\n'),
            errors: [{ column: 30, line: 2, messageId: 'repeated' }],
            filename: SPEC,
            output: [
                IMPORT,
                '',
                'const e = api.with({ clock: X });',
                "test('a', async () => { await e.headers(X).get('/e'); });",
                "test('b', async () => { await e.headers(Y).get('/e'); });",
            ].join('\n'),
        },
        {
            name: 'A job named for an action is still the subject its view is named for.',
            code: [
                "import { job } from '../job.specification.js';",
                "test('a', async () => { await job.clock('x').trigger('update'); });",
                "test('b', async () => { await job.clock('x').trigger('update'); });",
            ].join('\n'),
            errors: [{ column: 30, line: 2, messageId: 'repeated' }],
            filename: '/repo/specs/job/update/x.spec.ts',
            output: [
                "import { job } from '../job.specification.js';",
                '',
                "const update = job.with({ clock: 'x' });",
                "test('a', async () => { await update.trigger('update'); });",
                "test('b', async () => { await update.trigger('update'); });",
            ].join('\n'),
        },
        {
            name: 'A command named for an action is still the subject its view is named for.',
            code: [
                "import { cli } from '../cli.specification.js';",
                "test('a', async () => { await cli.env(E).exec('create'); });",
                "test('b', async () => { await cli.env(E).exec('create'); });",
            ].join('\n'),
            errors: [{ column: 30, line: 2, messageId: 'repeated' }],
            filename: '/repo/specs/cli/create/x.spec.ts',
            output: [
                "import { cli } from '../cli.specification.js';",
                '',
                'const create = cli.with({ env: E });',
                "test('a', async () => { await create.exec('create'); });",
                "test('b', async () => { await create.exec('create'); });",
            ].join('\n'),
        },
        {
            name: 'The view is named for the subject of its own specification.',
            code: [
                "import { api, job } from '../../api.specification.js';",
                "test('a', async () => { await job.trigger('sync'); await api.clock('x').get('/events'); });",
                "test('b', async () => { await api.clock('x').get('/events'); });",
            ].join('\n'),
            errors: [{ column: 57, line: 2, messageId: 'repeated' }],
            filename: SPEC,
            output: [
                "import { api, job } from '../../api.specification.js';",
                '',
                "const events = api.with({ clock: 'x' });",
                "test('a', async () => { await job.trigger('sync'); await events.get('/events'); });",
                "test('b', async () => { await events.get('/events'); });",
            ].join('\n'),
        },
        {
            name: 'A route whose segment may be a value names no subject, and the view is named for the file.',
            code: [
                IMPORT,
                "test('a', async () => { await api.clock('x').get('/indicators/btc/chart'); });",
                "test('b', async () => { await api.clock('x').get('/indicators/btc/chart'); });",
            ].join('\n'),
            errors: [{ column: 30, line: 2, messageId: 'repeated' }],
            filename: SPEC,
            output: [
                IMPORT,
                '',
                "const apiInFile = api.with({ clock: 'x' });",
                "test('a', async () => { await apiInFile.get('/indicators/btc/chart'); });",
                "test('b', async () => { await apiInFile.get('/indicators/btc/chart'); });",
            ].join('\n'),
        },
    ],
    valid: [
        {
            name: 'A setting called with no argument sets nothing.',
            code: `${IMPORT}\ntest('a', async () => { await api.clock().get('/e'); });\ntest('b', async () => { await api.clock().get('/e'); });`,
            filename: SPEC,
        },
        {
            name: 'Only an import brings a runner: a re-export of one from a specification is none.',
            code: "import { api } from '../../api.js';\nexport { api } from '../../api.specification.js';\ntest('a', async () => { await api.clock('x').get('/e'); });\ntest('b', async () => { await api.clock('x').get('/e'); });",
            filename: SPEC,
        },
        {
            name: 'A handle imported from no specification is no runner.',
            code: "import { api } from '../../api.js';\nimport { job } from '../../job.specification.json';\ntest('a', async () => { await api.clock('x').get('/e'); await job.clock('x').trigger('r'); });\ntest('b', async () => { await api.clock('x').get('/e'); await job.clock('x').trigger('r'); });",
            filename: SPEC,
        },
        {
            name: 'A name a specification exports that is no specification is no runner, and a setting another specification owns is no setting here.',
            code: "import { helper, api } from '../../api.specification.js';\ntest('a', async () => { await helper.clock('x').get('/e'); await api.env(E).get('/e'); });\ntest('b', async () => { await helper.clock('x').get('/e'); await api.env(E).get('/e'); });",
            filename: SPEC,
        },
        {
            name: 'One chain states nothing about a file.',
            code: `${IMPORT}\ntest('a', async () => { await api.clock('x').get('/events'); });`,
            filename: SPEC,
        },
        {
            name: 'Two instants are two conditions.',
            code: `${IMPORT}\ntest('a', async () => { await api.clock('x').get('/e'); });\ntest('b', async () => { await api.clock('y').get('/e'); });`,
            filename: SPEC,
        },
        {
            name: 'A chain without the setting breaks the pattern.',
            code: `${IMPORT}\ntest('a', async () => { await api.clock('x').get('/e'); });\ntest('b', async () => { await api.get('/e'); });`,
            filename: SPEC,
        },
        {
            name: 'A seed repeated is a Given, never a setting.',
            code: `${IMPORT}\ntest('a', async () => { await api.seed(S).get('/e'); });\ntest('b', async () => { await api.seed(S).get('/e'); });`,
            filename: SPEC,
        },
        {
            name: 'A module test is not a spec.',
            code: `${IMPORT}\ntest('a', async () => { await api.clock('x').get('/e'); });\ntest('b', async () => { await api.clock('x').get('/e'); });`,
            filename: '/repo/src/events.test.ts',
        },
    ],
});
