import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { RUNNER, specsTree, TWO_ROUTES } from '../../../__tests__/subject.fixtures.js';
import {
    aspectOf,
    lineEnd,
    secondSubjectAt,
    silenced,
    splitPlan,
    subjectSpecs,
    testsIn,
    withLeadingComments,
} from '../spec-subjects.js';

const CLI_RUNNER =
    "export const { cli } = await specification.cli('app', { commands: ['build', 'serve'] });\n";

const CLI_SPEC = [
    "import { cli } from '../cli.specification.js';",
    "import { cli as bare } from '../bare.specification';",
    "import { api } from '../../api/api.specification.js';",
    '',
    '// the build test',
    '/**',
    ' * builds the project',
    ' */',
    "test('builds', async () => {",
    "    await cli.exec('build fast');",
    "    test('nested', () => {});",
    '});',
    "cli.exec('serve');",
    'test(title, async () => {',
    "    await bare.exec('serve');",
    "    await api.get('/orders');",
    '});',
    "test('runs nothing', async () => {",
    "    await cli.exec('');",
    '});',
].join('\n');

describe('spec-subjects', () => {
    test('lineEnd — past the newline of the line, or the end of a text whose last line has none', () => {
        // Given - a text of two lines, the last unterminated
        const text = 'one\ntwo';

        // Then - the end of each line
        expect([lineEnd(text, 0), lineEnd(text, 5)]).toStrictEqual([4, 7]);
    });

    test('withLeadingComments — a declaration starts at the comments above it, line or block, and not past a blank line', () => {
        // Given - a statement under a line comment and a doc block, below a blank line and code
        const text = 'code();\n\n// one\n/**\n * two\n */\ntest();\n';

        // Then - its start climbs to the line comment, not to the code
        expect(withLeadingComments(text, text.indexOf('test'))).toBe(text.indexOf('// one'));
    });

    test('subjectSpecs — each spec of a subject specification, its tests with their spans, titles and the subjects of its own specification', () => {
        // Given - a cli spec reading its runners' commands, one runner imported without extension, an api call it does not own, and a module test beside it
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'cli/bare.specification.ts': CLI_RUNNER,
            'cli/cli.specification.ts': CLI_RUNNER,
            'cli/gone/gone.spec.ts': "import { cli } from '../missing.specification.js';\n",
            'cli/helpers.test.ts': "test('a', () => {});\n",
            'cli/project/project.spec.ts': CLI_SPEC,
            'helpers/x.spec.ts': "test('a', () => {});\n",
        });

        // Then - the cli specs, the tests of the project spec and what each reaches
        const specs = subjectSpecs(root);
        const project = specs.find((spec) => spec.file.endsWith('project.spec.ts'));
        expect([
            specs.map((spec) => spec.file.slice(root.length + 1)).toSorted(),
            project?.reading.commands,
            specs.find((spec) => spec.file.endsWith('gone.spec.ts'))?.reading.commands,
            [...(project?.subjects.keys() ?? [])],
            project?.tests.map(({ end, start, subjects, title }) => [
                title,
                CLI_SPEC.slice(start, end).split('\n')[0],
                subjects,
            ]),
        ]).toStrictEqual([
            ['cli/gone/gone.spec.ts', 'cli/project/project.spec.ts'],
            { bare: ['build', 'serve'], cli: ['build', 'serve'] },
            {},
            ['exec build', 'exec serve', 'exec (no command)'],
            [
                ['builds', '// the build test', ['exec build']],
                ['(a computed title)', 'test(title, async () => {', ['exec serve']],
                ['runs nothing', "test('runs nothing', async () => {", ['exec (no command)']],
            ],
        ]);
    });

    test('testsIn — a table test is one test to the close of its last call, titled by that call, whatever its rows call and wherever its calls break', () => {
        // Given - a table whose rows are built by calls, then a plain test
        const text = [
            'test.each([row(1), row(2)])',
            "    ('reads %s', async (n) => {",
            '    expect(n).toBeDefined();',
            '});',
            "it.each([row(3)])('direct', (n) => {});",
            "test('plain', () => {});",
            '',
        ].join('\n');

        // Then - two tests, each whole, each under its title
        expect(
            testsIn(text).map(({ end, start, title }) => [title, text.slice(start, end)]),
        ).toStrictEqual([
            ['reads %s', text.split('it.each')[0]],
            ['direct', "it.each([row(3)])('direct', (n) => {});\n"],
            ['plain', "test('plain', () => {});\n"],
        ]);
    });

    test('splitPlan — each subject to its folder, the first keeping the file when no folder holds it, a later one with no folder left out, a test of no subject planning nothing', () => {
        // Given - a spec opening on a test of no subject, then on a subject with no folder, then on one that has one; and the reverse
        const root = specsTree({
            'cli/cli.specification.ts': CLI_RUNNER,
            'cli/project/project.spec.ts': [
                "import { cli } from '../cli.specification.js';",
                "test('neutral', () => {});",
                "test('a', async () => { await cli.exec(''); });",
                "test('b', async () => { await cli.exec('build'); });",
                '',
            ].join('\n'),
            'cli/tasks/tasks.spec.ts': [
                "import { cli } from '../cli.specification.js';",
                "test('a', async () => { await cli.exec('build'); });",
                "test('b', async () => { await cli.exec(''); });",
                '',
            ].join('\n'),
        });

        // Then - where each subject goes
        const plans = subjectSpecs(root).map((spec) =>
            Object.fromEntries(
                [...splitPlan(root, spec)].map(([name, path]) => [
                    name,
                    path.slice(root.length + 1),
                ]),
            ),
        );
        expect(plans).toStrictEqual([
            {
                'exec (no command)': 'cli/project/project.spec.ts',
                'exec build': 'cli/build/project.spec.ts',
            },
            { 'exec build': 'cli/build/tasks.spec.ts' },
        ]);
    });

    test('secondSubjectAt and silenced — the second subject is where the suppression is read, and the first line stands in for a spec of one', () => {
        // Given - a spec of two routes silenced at its second, and one of a single route silenced on its first line
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/request/__requests__/create.http': 'POST /orders HTTP/1.1\n',
            'api/request/request.spec.ts': [
                "import { api } from '../api.specification.js';",
                "test('a', async () => { await api.request(file('./__requests__/create.http')); });",
                "test('b', async () => { await api.get('/orders'); });",
                '',
            ].join('\n'),
            'api/one/one.spec.ts': [
                "import { api } from '../api.specification.js'; // checker-disable-line one-subject-per-spec -- the case",
                "test('a', async () => { await api.get('/a'); });",
                '',
            ].join('\n'),
            'api/orders/orders.spec.ts': TWO_ROUTES.replace(
                '        // Given - an empty table',
                '        // checker-disable-next-line one-subject-per-spec -- one journey',
            ),
        });

        // Then - where each second subject sits, and whether the rule is silenced there
        expect(
            subjectSpecs(root).map((spec) => [
                aspectOf(spec.file),
                secondSubjectAt(spec),
                silenced(spec, 'one-subject-per-spec'),
                silenced(spec, 'other-rule'),
            ]),
        ).toStrictEqual([
            ['one', { column: 1, line: 1 }, true, false],
            ['orders', { column: 30, line: 25 }, true, false],
            ['request', { column: 31, line: 3 }, false, false],
        ]);
    });

    test('aspectOf — the file name without its spec suffix', () => {
        // Given - a spec named twice over
        // Then - only the last suffix goes
        expect(aspectOf(join('specs', 'api', 'a.spec.ts.spec.ts'))).toBe('a.spec.ts');
    });
});
