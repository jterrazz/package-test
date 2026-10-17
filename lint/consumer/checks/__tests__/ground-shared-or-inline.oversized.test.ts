import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import {
    capFinding,
    fixOversizedValues,
    oversizedValues,
} from '../ground-shared-or-inline.oversized.js';
import {
    block,
    dedented,
    keysJson,
    OVERSIZED_SPEC,
} from './ground-shared-or-inline.oversized.fixtures.js';

const SPEC = 'specs/api/users.spec.ts';

describe('ground-shared-or-inline.oversized', () => {
    test('a value past its cap is named with the file it moves to, or why the fixer leaves it', () => {
        // Given - a spec writing requests and expectations of every form, some at or under their caps, one in a string, one silenced
        const root = packageWith({ [SPEC]: OVERSIZED_SPEC });

        // Then - each value past its cap, where it starts, its lines and the file it takes
        expect(
            oversizedValues(root).map((oversized) => {
                const { column, fix, found, line } = capFinding(root, oversized);
                return `${line}:${column} ${found} — ${fix}`;
            }),
        ).toStrictEqual([
            "4:35 a request of 33 lines written in the test, past the __requests__/ cap of 30 — move it to ./__requests__/creates-a-user.txt and name it with file('./__requests__/creates-a-user.txt'); `typescript fix` moves it",
            "39:31 a request of 31 lines written in the test, past the __requests__/ cap of 30 — move it to ./__requests__/replaces-it.json and name it with file('./__requests__/replaces-it.json'); `typescript fix` moves it",
            "40:46 a request of 32 lines written in the test, past the __requests__/ cap of 30 — move it to ./__requests__/replaces-it.json and name it with file('./__requests__/replaces-it.json'); `typescript fix` moves it",
            "43:23 a request of 31 lines written in the test, past the __requests__/ cap of 30 — move it to ./__requests__/sends-raw.http and name it with file('./__requests__/sends-raw.http'); `typescript fix` moves it",
            "145:25 a request of 33 lines written in the test, past the __requests__/ cap of 30 — move it to ./__requests__/renames-it.txt and name it with file('./__requests__/renames-it.txt'); `typescript fix` moves it",
            '178:26 a request of 32 lines written in the test, past the __requests__/ cap of 30 — move it to a file under ./__requests__/ and name it with file(), by hand, since the fixer reads a string, a template or a JSON value only',
            "212:33 an expectation of 151 lines written in the test, past the __expected__/ cap of 150 — move it to ./__expected__/lists-users.json and name it with file('./__expected__/lists-users.json'); `typescript fix` moves it",
            "213:37 an expectation of 151 lines written in the test, past the __expected__/ cap of 150 — move it to ./__expected__/lists-users.http and name it with file('./__expected__/lists-users.http'); `typescript fix` moves it",
            "366:35 an expectation of 151 lines written in the test, past the __expected__/ cap of 150 — move it to ./__expected__/lists-users.txt and name it with file('./__expected__/lists-users.txt'); `typescript fix` moves it",
            "519:28 an expectation of 153 lines written in the test, past the __expected__/ cap of 150 — a string has no golden: wrap it, `expect(text(output)).toMatch(file('./__expected__/lists-users.txt'))`, or compare the result it came from to its file; by hand: the fixer never writes a string's comparison to a file",
            '825:34 an expectation of 151 lines written in the test, past the __expected__/ cap of 150 — move it to a file under ./__expected__/ and name it with file(), by hand, since the fixer reads a string, a template or a JSON value only',
        ]);
    });

    test('the fix writes each value it can read to its file, from the last, a name taken by other bytes suffixed', () => {
        // Given - the same spec, and a file already holding the bytes of one of its values
        const root = packageWith({
            'specs/api/__requests__/sends-raw.http': dedented(31),
            [SPEC]: OVERSIZED_SPEC,
        });

        // When - the fixer runs
        const done = fixOversizedValues(root);

        // Then - every value it can read moved, the spec names each file, and the rest is the author's
        const spec = readFileSync(join(root, SPEC), 'utf8').split('\n');
        const read = (path: string): string => readFileSync(join(root, 'specs/api', path), 'utf8');
        expect([done, spec.filter((line) => line.includes('file'))]).toStrictEqual([
            [
                'specs/api/users.spec.ts:366 → specs/api/__expected__/lists-users.txt',
                'specs/api/users.spec.ts:213 → specs/api/__expected__/lists-users.http',
                'specs/api/users.spec.ts:212 → specs/api/__expected__/lists-users.json',
                'specs/api/users.spec.ts:145 → specs/api/__requests__/renames-it.txt',
                'specs/api/users.spec.ts:43 → specs/api/__requests__/sends-raw.http',
                'specs/api/users.spec.ts:40 → specs/api/__requests__/replaces-it.json',
                'specs/api/users.spec.ts:39 → specs/api/__requests__/replaces-it-2.json',
                'specs/api/users.spec.ts:4 → specs/api/__requests__/creates-a-user.txt',
            ],
            [
                "import { file } from '@jterrazz/test';",
                "    await api.post('/users, all', file('./__requests__/creates-a-user.txt'));",
                "    await api.put(path(1, 2), file('./__requests__/replaces-it-2.json'));",
                "    await api.put(['/users', 'x'].join('/'), file('./__requests__/replaces-it.json'));",
                "    await api.request(file('./__requests__/sends-raw.http'));",
                "    await api.put('/x', file('./__requests__/renames-it.txt'));",
                "    expect(result.json).toMatch(file('./__expected__/lists-users.json'));",
                "    expect(result.response).toMatch(file('./__expected__/lists-users.http'));",
                "    expect(result.stdout).toMatch(file('./__expected__/lists-users.txt'));",
            ],
        ]);
        expect([
            read('__requests__/creates-a-user.txt'),
            read('__requests__/replaces-it.json'),
            read('__requests__/replaces-it-2.json'),
            read('__expected__/lists-users.json'),
        ]).toStrictEqual([block(31).slice(1, -1), keysJson(30), keysJson(29), keysJson(149)]);
    });
});
