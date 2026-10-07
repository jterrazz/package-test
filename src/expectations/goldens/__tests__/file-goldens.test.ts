import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { DirectoryAccessor } from '../../disk/directory.js';
import { FilesystemAccessor } from '../../disk/filesystem.js';
import { JsonAccessor } from '../../text/json.js';
import { TextAccessor } from '../../text/text.js';
import { CaptureScope } from '../../tokens/capture-scope.js';
import { textEquals } from '../../tokens/structural.js';
import {
    matchDirectoryGolden,
    matchJsonFile,
    matchStreamFile,
    recordedGolden,
} from '../file-goldens.js';
import type { MatcherResult } from '../file-goldens.js';

const UPDATE_HINT = 'Run with TEST_UPDATE=1 (or vitest -u) to create it.';

const FROZEN_HINT =
    'This golden is `{ frozen }`: update mode never writes it. Write the file by hand, or drop `{ frozen }` for one TEST_UPDATE=1 run and put it back.';

/** A scratch test folder holding the given goldens under `__expected__/`. */
function scratchWith(goldens: Record<string, string> = {}): string {
    const scratch = mkdtempSync(join(tmpdir(), 'file-goldens-'));
    for (const [name, content] of Object.entries(goldens)) {
        mkdirSync(resolve(scratch, '__expected__', name, '..'), { recursive: true });
        writeFileSync(resolve(scratch, '__expected__', name), content);
    }
    return scratch;
}

const read = (result: MatcherResult): [boolean, string] => [result.pass, result.message()];

/** The verdict on a tree, as `read` gives it. */
async function treeVerdict(
    subject: unknown,
    path: string,
    frozen = false,
): Promise<[boolean, string]> {
    return read(await matchDirectoryGolden(subject, path, frozen));
}

describe('file-goldens', () => {
    test('recordedGolden — no file and a blank one are not recorded yet, anything else is, as written', () => {
        // Given - a missing golden, a blank one, and one holding text padded with spaces
        const scratch = scratchWith({ 'blank.txt': ' \n\t\n', 'padded.txt': '  out \n' });

        // Then - nothing for the first two, the text untouched for the third
        expect(
            ['missing.txt', 'blank.txt', 'padded.txt'].map((name) =>
                recordedGolden(resolve(scratch, '__expected__', name)),
            ),
        ).toStrictEqual([null, null, '  out \n']);
    });

    test('matchStreamFile — compares a stream to its golden, names a missing one with the run that writes it, and refuses a name with no extension or not relative', async () => {
        // Given - a stream, its golden, a wrong one, and names of no golden
        const scratch = scratchWith({ 'help.txt': 'usage: {{any}}\n', 'wrong.txt': 'other\n' });
        const stream = new TextAccessor('usage: cli\n', 'stdout', scratch);

        // Then - each verdict whole
        expect([
            read(matchStreamFile(stream, './__expected__/help.txt', false)),
            matchStreamFile(stream, './__expected__/wrong.txt', false).pass,
            read(matchStreamFile(stream, './__expected__/none.txt', false)),
            read(matchStreamFile(stream, './__expected__/none.txt', true)),
        ]).toStrictEqual([
            [true, 'expected stdout not to match ./__expected__/help.txt'],
            false,
            [
                false,
                `stdout fixture "./__expected__/none.txt" does not exist at ${resolve(scratch, '__expected__/none.txt')}.\n${UPDATE_HINT}`,
            ],
            [
                false,
                `stdout fixture "./__expected__/none.txt" does not exist at ${resolve(scratch, '__expected__/none.txt')}.\n${FROZEN_HINT}`,
            ],
        ]);
        expect(() => matchStreamFile(stream, '/abs/help.txt', false)).toThrow(
            'toMatch("/abs/help.txt"), a path that is not relative to the spec file',
        );
        expect(() =>
            matchJsonFile(new JsonAccessor('1', 'body', scratch), '/abs/v.json', false),
        ).toThrow('toMatch("/abs/v.json"), a path that is not relative to the spec file');
        await expect(
            treeVerdict(new DirectoryAccessor(scratch, scratch), '/abs/tree/'),
        ).rejects.toThrow('toMatch("/abs/tree/"), a path that is not relative to the spec file');
        expect(() => matchStreamFile(stream, './__expected__/help', false)).toThrow(
            'toMatch(file("./__expected__/help")) on stream, a golden path with no extension',
        );
    });

    test('matchJsonFile — compares a value to its golden structurally, shows the difference, and names a missing one', () => {
        // Given - a value, its golden with a token, a wrong one, and a name of no golden
        const scratch = scratchWith({
            'user.json': '{ "id": "{{uuid}}", "name": "Ada" }',
            'wrong.json': '{ "name": "Bob" }',
        });
        const value = new JsonAccessor(
            '{ "id": "3f2504e0-4f89-41d3-9a0c-0305e82c3301", "name": "Ada" }',
            'body',
            scratch,
        );

        // Then - each verdict
        expect([
            read(matchJsonFile(value, './__expected__/user.json', false)),
            matchJsonFile(value, './__expected__/wrong.json', false).message().split('\n')[0],
            read(matchJsonFile(value, './__expected__/none.json', false)),
        ]).toStrictEqual([
            [true, 'expected JSON not to match ./__expected__/user.json'],
            'Response mismatch (./__expected__/wrong.json)',
            [
                false,
                `JSON fixture "./__expected__/none.json" does not exist at ${resolve(scratch, '__expected__/none.json')}.\n${UPDATE_HINT}`,
            ],
        ]);
        expect(() => matchJsonFile(value, './__expected__/user', false)).toThrow(
            'toMatch(file("./__expected__/user")) on json, a golden path with no extension',
        );
    });

    test('update mode — writes each golden from what it read, the tokens a golden already held kept, and never a frozen one', () => {
        // Given - update mode, goldens holding tokens, and a frozen golden never written
        vi.stubEnv('TEST_UPDATE', '1');
        const scratch = scratchWith({
            'help.txt': 'run {{uuid}}\n',
            'user.json': '{ "id": "{{uuid}}" }',
        });
        const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
        const stream = new TextAccessor(`run ${id}\nmore\n`, 'stdout', scratch);
        const value = new JsonAccessor(`{ "id": "${id}", "name": "Ada" }`, 'body', scratch);

        // When - each golden is matched
        const results = [
            read(matchStreamFile(stream, './__expected__/help.txt', false)),
            read(matchJsonFile(value, './__expected__/user.json', false)),
            read(matchJsonFile(value, './__expected__/fresh.json', false)),
            read(matchJsonFile(value, './__expected__/frozen.json', true)),
        ];

        // Then - updated, each token kept where it stood, the fresh one written whole, the frozen one not written
        const golden = (name: string): string =>
            readFileSync(resolve(scratch, '__expected__', name), 'utf8');
        expect([
            results,
            golden('help.txt'),
            golden('user.json'),
            golden('fresh.json'),
            existsSync(resolve(scratch, '__expected__', 'frozen.json')),
        ]).toStrictEqual([
            [
                [true, 'updated ./__expected__/help.txt'],
                [true, 'updated ./__expected__/user.json'],
                [true, 'updated ./__expected__/fresh.json'],
                [
                    false,
                    `JSON fixture "./__expected__/frozen.json" does not exist at ${resolve(scratch, '__expected__/frozen.json')}.\n${FROZEN_HINT}`,
                ],
            ],
            'run {{uuid}}\nmore\n',
            `{\n    "id": "{{uuid}}",\n    "name": "Ada"\n}\n`,
            `{\n    "id": "${id}",\n    "name": "Ada"\n}\n`,
            false,
        ]);
    });

    test('matchDirectoryGolden — compares a tree or a filesystem to its golden folder, names a missing one, and refuses a subject that is no tree', async () => {
        // Given - an output tree, its golden folder, a wrong one, and a text subject
        const scratch = scratchWith({
            'bound-actual/a.txt': 'run 9b2504e0-4f89-41d3-9a0c-0305e82c3301\n',
            'bound/a.txt': 'run {{uuid#id}}\n',
            'more/a.txt': 'run 1\n',
            'more/b.txt': 'extra\n',
            'tree/a.txt': 'run {{any}}\n',
            'wrong/a.txt': 'other\n',
        });
        const actual = resolve(scratch, 'actual');
        mkdirSync(actual);
        writeFileSync(resolve(actual, 'a.txt'), 'run 1\n');

        const tree = new DirectoryAccessor(actual, scratch);
        const scope = new CaptureScope();
        textEquals('{{uuid#id}}', '3f2504e0-4f89-41d3-9a0c-0305e82c3301', scope);
        const more = new DirectoryAccessor(resolve(scratch, '__expected__/more'), scratch);
        const bound = new DirectoryAccessor(
            resolve(scratch, '__expected__/bound-actual'),
            scratch,
            scope,
        );

        // Then - each verdict
        expect([
            await treeVerdict(tree, './__expected__/tree/'),
            await treeVerdict(new FilesystemAccessor(actual, scratch), './__expected__/tree/'),
            await treeVerdict(tree, './__expected__/wrong/'),
            await treeVerdict(tree, './__expected__/none/', true),
            await treeVerdict(bound, './__expected__/bound/'),
            await treeVerdict(tree, './__expected__/more/'),
            await treeVerdict(more, './__expected__/tree/'),
        ]).toStrictEqual([
            [true, 'expected directory not to match ./__expected__/tree/'],
            [true, 'expected directory not to match ./__expected__/tree/'],
            [false, expect.stringContaining('./__expected__/wrong/')],
            [
                false,
                `Directory fixture "./__expected__/none/" does not exist at ${resolve(scratch, '__expected__/none')}.\n${FROZEN_HINT}`,
            ],
            [false, expect.stringContaining('./__expected__/bound/')],
            [false, expect.stringContaining('Run with TEST_UPDATE=1 to update the fixture.')],
            [false, expect.stringContaining('Run with TEST_UPDATE=1 to update the fixture.')],
        ]);
        await expect(
            treeVerdict(new TextAccessor('x', 'stdout', scratch), './__expected__/tree/'),
        ).rejects.toThrow(
            new TypeError(
                [
                    'found: toMatch(directory("./__expected__/tree/")) on a subject that is no tree',
                    'why: `toMatch` on a result the framework produced compares the WHOLE result, to a value written in place or to a `file()`/`directory()` golden.',
                    'fix: compare result.filesystem or result.directory(…) to directory("./__expected__/tree/"); a text is compared to file(…)',
                    'read: docs/reference/linting.md#one-verb-per-meaning',
                ].join('\n'),
            ),
        );
    });

    test('update mode — a golden folder is rewritten from the tree, a file whose golden held tokens keeping them, a file gone from the tree gone from it', async () => {
        // Given - update mode, a golden folder holding a token and a file the tree no longer has
        vi.stubEnv('TEST_UPDATE', '1');
        const scratch = scratchWith({ 'tree/a.txt': 'run {{uuid}}\n', 'tree/stale.txt': 'gone\n' });
        const actual = resolve(scratch, 'actual');
        mkdirSync(actual);
        writeFileSync(resolve(actual, 'a.txt'), 'run 3f2504e0-4f89-41d3-9a0c-0305e82c3301\n');
        writeFileSync(resolve(actual, 'b.txt'), 'new\n');

        // When - the tree is matched, and a frozen folder never written
        const tree = new DirectoryAccessor(actual, scratch);
        const results = [
            await treeVerdict(tree, './__expected__/tree/'),
            await treeVerdict(tree, './__expected__/frozen/', true),
            await treeVerdict(tree, './__expected__/nested/fresh/'),
        ];

        // Then - the folder as the tree is, the token kept
        const golden = (name: string): null | string =>
            recordedGolden(resolve(scratch, '__expected__/tree', name));
        expect([
            results,
            golden('a.txt'),
            golden('b.txt'),
            golden('stale.txt'),
            existsSync(resolve(scratch, '__expected__/frozen')),
        ]).toStrictEqual([
            [
                [true, 'updated ./__expected__/tree/'],
                [
                    false,
                    `Directory fixture "./__expected__/frozen/" does not exist at ${resolve(scratch, '__expected__/frozen')}.\n${FROZEN_HINT}`,
                ],
                [true, 'updated ./__expected__/nested/fresh/'],
            ],
            'run {{uuid}}\n',
            'new\n',
            null,
            false,
        ]);
    });
});
