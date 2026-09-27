import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';

import { ruleTester } from '../../../engine/testing/rule-tester.js';
import { noSingleUseRef } from './no-single-use-ref.js';

// Built at module load: the rule reads the fixtures on disk before the cases run.
const featureDir = mkdtempSync(join(tmpdir(), 'no-single-use-ref-'));
const specsFeatureDir = join(featureDir, 'specs', 'app', 'widget');
const expectedDir = join(specsFeatureDir, '_expected');
mkdirSync(expectedDir, { recursive: true });
// A fixture whose only capture ref appears exactly once, nowhere in code.
writeFileSync(join(expectedDir, 'lonely.txt'), 'id: {{uuid#lonely}}\n');
// A fixture carrying a ref that a code `match.ref` also asserts (two uses total).
writeFileSync(join(expectedDir, 'shared.txt'), 'id: {{uuid#order}}\n');

const WIDGET = join(specsFeatureDir, 'widget.test.ts');
const SPEC_FILE = join(specsFeatureDir, 'widget.specification.ts');

afterAll(() => {
    rmSync(featureDir, { force: true, recursive: true });
});

ruleTester().run('no-single-use-ref', noSingleUseRef, {
    invalid: [
        // A code ref that never asserts a second occurrence.
        {
            code: 'expect(result.value).toEqual({ id: match.ref("order") });',
            errors: [{ column: 35, line: 1, message: /order/u }],
            filename: WIDGET,
        },
        // A ref that lives ONLY in a referenced fixture, used once: reported on
        // the referencing toMatch node (the rule enhancement — no code site).
        {
            code: 'expect(result.stdout).toMatch(file("./_expected/lonely.txt"));',
            errors: [{ column: 0, line: 1, message: /lonely/u }],
            filename: WIDGET,
        },
    ],
    valid: [
        // The same code ref asserted twice earns its name.
        {
            code: 'expect(a).toEqual(match.ref("order")); expect(b).toEqual(match.ref("order"));',
            filename: WIDGET,
        },
        // A code ref (once) plus the same ref in a referenced fixture (once) = two uses.
        {
            code: 'expect(a).toEqual(match.ref("order")); expect(result.stdout).toMatch(file("./_expected/shared.txt"));',
            filename: WIDGET,
        },
        // No capture refs at all.
        { code: 'expect(a).toBe(1);', filename: WIDGET },
        // A specification file is not a test file — the rule is inert.
        {
            code: 'expect(result.value).toEqual({ id: match.ref("order") });',
            filename: SPEC_FILE,
        },
        // Outside specs/ the rule is inert.
        {
            code: 'expect(result.value).toEqual({ id: match.ref("order") });',
            filename: '/repo/src/specification/matching/match.test.ts',
        },
    ],
});
