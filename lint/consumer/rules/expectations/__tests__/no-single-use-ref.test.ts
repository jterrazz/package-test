import { ruleTester } from '@jterrazz/test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';

import { noSingleUseRef } from '../no-single-use-ref.js';

// invariant: built at module load: the rule reads the fixtures on disk before the cases run.
const featureDir = mkdtempSync(join(tmpdir(), 'no-single-use-ref-'));
const specsFeatureDir = join(featureDir, 'specs', 'app', 'widget');
const expectedDir = join(specsFeatureDir, '__expected__');
mkdirSync(expectedDir, { recursive: true });
// invariant: a fixture whose only capture ref appears exactly once, nowhere in code.
writeFileSync(join(expectedDir, 'lonely.txt'), 'id: {{uuid#lonely}}\n');
// invariant: a fixture carrying a ref that a code `match.ref` also asserts (two uses total).
writeFileSync(join(expectedDir, 'shared.txt'), 'id: {{uuid#order}}\n');
// invariant: a tree whose two files share one ref, and a tree whose one file holds a ref alone.
mkdirSync(join(expectedDir, 'tree'));
writeFileSync(join(expectedDir, 'tree', 'a.txt'), 'id: {{uuid#pair}}\n');
writeFileSync(join(expectedDir, 'tree', 'b.txt'), 'id: {{uuid#pair}}\n');
mkdirSync(join(expectedDir, 'single'));
writeFileSync(join(expectedDir, 'single', 'a.txt'), 'id: {{uuid#solo}}\n');

const WIDGET = join(specsFeatureDir, 'widget.test.ts');
const SPEC_FILE = join(specsFeatureDir, 'widget.specification.ts');

afterAll(() => {
    rmSync(featureDir, { force: true, recursive: true });
});

ruleTester().run('no-single-use-ref', noSingleUseRef, {
    invalid: [
        {
            name: 'A ref a value written in place holds once is used once, reported where it is written.',
            code: 'expect(result.stdout).toMatch(`\n    id {{uuid#once}}\n`);',
            errors: [{ column: 30, line: 1, message: /once/u }],
            filename: WIDGET,
        },
        {
            name: 'A ref a fixture tree holds once is used once.',
            code: 'await expect(result.directory("out")).toMatch(directory("./__expected__/single/"));',
            errors: [{ column: 6, line: 1, message: /solo/u }],
            filename: WIDGET,
        },
        {
            name: 'A code ref that never asserts a second occurrence.',
            code: 'expect(result.value).toEqual({ id: match.ref("order") });',
            errors: [{ column: 35, line: 1, message: /order/u }],
            filename: WIDGET,
        },
        {
            name: 'A ref that lives ONLY in a referenced fixture, used once: reported on the referencing toMatch node (the rule enhancement — no code site).',
            code: 'expect(result.stdout).toMatch(file("./__expected__/lonely.txt"));',
            errors: [{ column: 0, line: 1, message: /lonely/u }],
            filename: WIDGET,
        },
    ],
    valid: [
        {
            name: 'A code ref beside a value written in place carrying the same ref twice earns its name: the id and the row it names agree.',
            code: 'expect(result.response).toMatch(`\n    {"id": "{{string#post}}"}\n`);\nexpect(await table("posts")).toMatch([["{{string#post}}"]]);\nexpect(row.id).toEqual(match.ref("post"));',
            filename: WIDGET,
        },
        {
            name: 'A ref two files of one tree share is used twice; a ref named by no literal, and one through no `match`, count nothing.',
            code: 'await expect(result.directory("out")).toMatch(directory("./__expected__/tree/"));\nexpect(a).toEqual(match.ref(name));\nexpect(b).toEqual(other.ref("x"));\nexpect(c).toEqual(match.other("y"));\nexpect(d).toEqual(a.match.ref("z"));',
            filename: WIDGET,
        },
        {
            name: 'The same code ref asserted twice earns its name.',
            code: 'expect(a).toEqual(match.ref("order")); expect(b).toEqual(match.ref("order"));',
            filename: WIDGET,
        },
        {
            name: 'A code ref (once) plus the same ref in a referenced fixture (once) = two uses.',
            code: 'expect(a).toEqual(match.ref("order")); expect(result.stdout).toMatch(file("./__expected__/shared.txt"));',
            filename: WIDGET,
        },
        { name: 'No capture refs at all.', code: 'expect(a).toBe(1);', filename: WIDGET },
        {
            name: 'A specification file is not a test file — the rule is inert.',
            code: 'expect(result.value).toEqual({ id: match.ref("order") });',
            filename: SPEC_FILE,
        },
        {
            name: 'Outside specs/ the rule is inert.',
            code: 'expect(result.value).toEqual({ id: match.ref("order") });',
            filename: '/repo/src/specification/matching/match.test.ts',
        },
    ],
});
