import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { RUNNER, specsTree } from '../../../__tests__/subject.fixtures.js';
import { splitPlan, subjectSpecs } from '../../../kit/project/spec-subjects.js';
import type { SpecRead } from '../../../kit/project/spec-subjects.js';
import { NO_READING } from '../../../kit/project/subject.js';
import { fixSpecInSubjectFolder } from '../spec-in-subject-folder.moves.js';
import { lostInSplit, splitRefusal } from '../spec-in-subject-folder.refusal.js';
import { besideData, CONSOLE_POSTS } from './spec-in-subject-folder.refusal.fixtures.js';

function refusalOf(files: Record<string, string>): string | undefined {
    const root = specsTree({ 'api/api.specification.ts': RUNNER, ...files });
    const [spec] = subjectSpecs(root);
    return spec === undefined ? 'no spec' : splitRefusal(root, spec, splitPlan(root, spec));
}

// invariant: the list test held by a construct `open` starts and `close` ends, a create test after it.
function held(open: string, close: string): string | undefined {
    return refusalOf({
        'api/orders/orders.spec.ts': [
            "import { api } from '../api.specification.js';",
            open,
            "    test('lists', async () => { await api.get('/orders'); }),",
            close,
            "test('creates', async () => { await api.post('/orders', {}); });",
            '',
        ].join('\n'),
    });
}

// invariant: a template hole spelt for the source a test writes, which no literal of this file may hold.
const hole = (name: string): string => ['$', '{', name, '}'].join('');

const TWO_TESTS = "test('a', () => {});\ntest('b', () => {});\n";

function specOf(text: string): SpecRead {
    return {
        file: '',
        reading: NO_READING,
        specification: 'api',
        subjects: new Map(),
        tests: [
            { end: 0, start: 0, subjects: [], title: 'a' },
            { end: 0, start: 0, subjects: [], title: 'b' },
        ],
        text,
    };
}

describe('spec-in-subject-folder.refusal', () => {
    test('splitRefusal — two subjects derived to one folder are refused, and the fix leaves the file whole — the console posts spec that lost 17 of 19 tests', () => {
        // Given - list, create and delete of one collection under /api, all three derived to api/posts
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/posts/__seeds__/posts.sql': 'INSERT INTO posts VALUES (1);\n',
            'api/posts/posts.spec.ts': CONSOLE_POSTS,
        });

        // When - the fix runs
        const done = fixSpecInSubjectFolder(root);

        // Then - nothing moved, every test still in the file, and the refusal names the clash
        const [spec] = subjectSpecs(root);
        expect({
            done,
            kept: readFileSync(join(root, 'api/posts/posts.spec.ts'), 'utf8') === CONSOLE_POSTS,
            refusal:
                spec === undefined ? undefined : splitRefusal(root, spec, splitPlan(root, spec)),
        }).toStrictEqual({
            done: [],
            kept: true,
            refusal:
                'GET /api/posts and POST /api/posts are both filed at api/api/posts/posts.spec.ts: the split cannot tell them apart',
        });
    });

    test('splitRefusal — a test inside a loop is refused: the cut would leave the loop emptied behind it', () => {
        // Given - a spec listing the orders, and reading each legacy id in a loop
        const refusal = refusalOf({
            'api/orders/orders.spec.ts': [
                "import { api } from '../api.specification.js';",
                '',
                "const LEGACY = ['a1', 'b2'];",
                '',
                "describe('orders', () => {",
                "    test('lists', async () => { await api.get('/orders'); });",
                '    for (const id of LEGACY) {',
                `        test(\`reads ${hole('id')}\`, async () => { await api.get('/orders/:id', { params: { id } }); });`,
                '    }',
                '});',
                '',
            ].join('\n'),
        });

        // Then - the refusal names the generated test
        expect(refusal).toBe(
            `the test "reads ${hole('id')}" stands inside a loop or a block that is no \`describe\`: a cut cannot tell how many tests it moves, nor leave the block whole`,
        );
    });

    test('splitRefusal — tests in a describe, a describe.each, a describe.skip spaced from its call, a `function ()` or a tight arrow callback, beside an options object, are cut freely', () => {
        // Given - the tests of two routes in every shape of group
        const refusal = refusalOf({
            'api/orders/orders.spec.ts': [
                "import { api } from '../api.specification.js';",
                '',
                "describe('orders', { timeout: 5 }, function () {",
                "    test('lists', async () => { await api.get('/orders'); });",
                "    describe.each([['a'], ['b']])('row %s', (row) => {",
                "        test('creates', async () => { await api.post('/orders', { row }); });",
                '    });',
                '});',
                "describe.skip ('removal', ()=>{",
                "    test('deletes', async () => { await api.delete('/orders/:id', { params: { id: 'a' } }); });",
                '});',
                '',
            ].join('\n'),
        });

        // Then - nothing refused
        expect(refusal).toBeUndefined();
    });

    test('splitRefusal — a test in an argument that is no callback body — an options object, an array a callback returns — is refused', () => {
        // Given - the list test held by an options object, then by an array the group's callback returns (`held`)
        // Then - both refused, at the held test
        const refused = `the test "lists" stands inside a loop or a block that is no \`describe\`: a cut cannot tell how many tests it moves, nor leave the block whole`;
        expect([
            held("describe(label('orders'), {\n    each:", '});'),
            held("describe('orders', () => [", ']);'),
        ]).toStrictEqual([refused, refused]);
    });

    test('splitRefusal — a spec moved whole is never refused for a loop: nothing is cut', () => {
        // Given - one route, its tests in a loop, filed outside its folder
        const refusal = refusalOf({
            'api/misc/orders.spec.ts': [
                "import { api } from '../api.specification.js';",
                'for (const n of [1, 2]) {',
                `    test(\`lists ${hole('n')}\`, async () => { await api.get('/orders'); });`,
                '}',
                '',
            ].join('\n'),
        });

        // Then - nothing refused
        expect(refusal).toBeUndefined();
    });

    test('splitRefusal — a move leaving a relative path no rebase carries is refused, naming it; one it carries, or naming nothing beside the spec, is not', () => {
        // Given - one route filed under misc/, beside a data file, read through a URL on another base, then through one the rebase carries
        // Then - the stranded path alone is refused
        expect([
            refusalOf(besideData("new URL('./data.json', base)")),
            refusalOf(besideData("new URL('./data.json', import.meta.url)")),
            refusalOf(besideData("new URL('./absent.json', base)")),
        ]).toStrictEqual([
            '`./data.json` names a path beside the spec that no rebase carries to api/orders/list/orders.spec.ts: its author writes it from there',
            undefined,
            undefined,
        ]);
    });

    test('splitRefusal — two later subjects with no folder are both named, in the plural', () => {
        // Given - a cli spec whose second and third tests run no command word
        const root = specsTree({
            'cli/cli.specification.ts':
                "export const { cli } = await specification.cli('app', { commands: ['build', 'serve'] });\n",
            'cli/build/build.spec.ts': [
                "import { cli } from '../cli.specification.js';",
                "test('a', async () => { await cli.exec('build'); });",
                "test('b', async () => { await cli.exec(''); });",
                '',
            ].join('\n'),
        });
        const [spec] = subjectSpecs(root);
        const reached = new Map([
            ...(spec?.subjects ?? []),
            ['exec other', { index: 0, subject: { command: [], specification: 'cli' as const } }],
        ]);
        const widened = spec === undefined ? undefined : { ...spec, subjects: reached };
        widened?.tests.push({ end: 0, start: 0, subjects: ['exec other'], title: 'c' });

        // Then - both subjects named
        expect(
            widened === undefined
                ? undefined
                : splitRefusal(root, widened, splitPlan(root, widened)),
        ).toBe(
            "exec (no command), exec other have no standard folder: the file they go to is its author's to name",
        );
    });

    test('lostInSplit — a split writing each test once, under its title, loses nothing', () => {
        // Given - a spec of tests a and b, split in two drafts holding one each
        // Then - nothing is lost
        expect(
            lostInSplit(specOf(TWO_TESTS), [
                { target: 'x', text: "test('b', () => {});\n" },
                { target: 'y', text: "test('a', () => {});\n" },
            ]),
        ).toBeUndefined();
    });

    test('lostInSplit — a test no draft holds, or one under another title, is named', () => {
        // Given - drafts holding a alone, or a and b under another title
        // Then - the missing test is named
        expect([
            lostInSplit(specOf(TWO_TESTS), [{ target: 'x', text: "test('a', () => {});\n" }]),
            lostInSplit(specOf(TWO_TESTS), [
                { target: 'x', text: "test('a', () => {});\ntest('a — b', () => {});\n" },
            ]),
        ]).toStrictEqual([
            'the split would lose the test "b"',
            'the split would lose the test "b"',
        ]);
    });

    test('lostInSplit — a test written twice, or a test call only the counting sees, is a split that is not whole', () => {
        // Given - drafts writing b twice, or a call nested in b that the source never held
        // Then - the counts are named
        expect([
            lostInSplit(specOf(TWO_TESTS), [
                { target: 'x', text: "test('a', () => {});\ntest('b', () => {});\n" },
                { target: 'y', text: "test('b', () => {});\n" },
            ]),
            lostInSplit(specOf(TWO_TESTS), [
                {
                    target: 'x',
                    text: "test('a', () => {});\ntest('b', () => { test('c', () => {}); });\n",
                },
            ]),
        ]).toStrictEqual([
            'the split would write 3 test calls of the 2 it read',
            'the split would write 3 test calls of the 2 it read',
        ]);
    });

    test('lostInSplit — a hook no draft holds is named, and one any draft holds, its paths rebased, is kept', () => {
        // Given - a spec of two tests and two hooks, drafts keeping each hook somewhere, then drafts dropping one
        const spec = specOf(
            `beforeAll(() => server.listen());\nafterEach(() => { reset(file('./a.json')); });\n${TWO_TESTS}`,
        );

        // Then - only the dropped hook is named
        expect([
            lostInSplit(spec, [
                { target: 'x', text: "beforeAll(() => server.listen());\ntest('a', () => {});\n" },
                {
                    target: 'y',
                    text: "afterEach(() => {\n    reset(file('../a.json'));\n});\ntest('b', () => {});\n",
                },
            ]),
            lostInSplit(spec, [
                {
                    target: 'x',
                    text: "afterEach(() => { reset(file('./a.json')); });\ntest('a', () => {});\n",
                },
                { target: 'y', text: "test('b', () => {});\n" },
            ]),
        ]).toStrictEqual([
            undefined,
            'the split would lose the hook `beforeAll` the tests it keeps may need',
        ]);
    });

    test('lostInSplit — two tests of one title are two tests: a draft holding one of them loses the other', () => {
        // Given - a spec titling two tests alike, and one draft holding one of them
        const twice: SpecRead = { ...specOf("test('a', () => {});\ntest('a', () => {});\n") };
        twice.tests = twice.tests.map((read) => ({ ...read, title: 'a' }));

        // Then - the second is named lost
        expect(lostInSplit(twice, [{ target: 'x', text: "test('a', () => {});\n" }])).toBe(
            'the split would lose the test "a"',
        );
    });
});
