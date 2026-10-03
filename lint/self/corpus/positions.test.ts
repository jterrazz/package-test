import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { Row } from '../../kit/catalogue/row.js';
import { allRows } from '../catalogue/manifest.js';
import { unpositionedRules } from './positions.js';

const ROOT = resolve(import.meta.dirname, '../../..');

function row(name: string, channel: Row['channel']): Row {
    return {
        audience: 'consumer',
        channel,
        sentence: '',
        facet: 'model',
        family: 'expectations',
        fix: '',
        name,
        rationale: '',
        reach: 'tests',
    };
}

describe('unpositionedRules', () => {
    test('positions — every static rule proves where it reports (meta-test `every-position-proven`) — each static and checker row of the catalogue states the line and column of a finding in a spec of its own', () => {
        // Given - every row of both catalogues

        // Then - none is left without a case that pins its position
        expect(unpositionedRules(ROOT, allRows)).toStrictEqual([]);
    });

    test('positions — every static rule proves where it reports (meta-test `every-position-proven`) — a report golden naming the rule at a position, or a rule test run through `ruleTester()`, which refuses a case with no line and column, proves it; a report never goldened, a hand-rolled tester or no spec does not, and another channel is not asked', () => {
        // Given - one row per form a proof takes, one per form that is no proof, and a runtime row
        const root = mkdtempSync(join(tmpdir(), 'positions-'));
        mkdirSync(join(root, 'specs/lint/golden-at-a-position'), { recursive: true });
        writeFileSync(
            join(root, 'specs/lint/golden-at-a-position/golden-at-a-position.spec.ts'),
            'expect(result.report).toMatch(`\n    scenario.test.ts:9:5  jterrazz(golden-at-a-position)\n`);',
        );
        mkdirSync(join(root, 'specs/lint/pass-at-a-position'), { recursive: true });
        writeFileSync(
            join(root, 'specs/lint/pass-at-a-position/pass-at-a-position.spec.ts'),
            'expect(result.report).toMatch(`\n    specs/a.spec.yaml:1:1  jterrazz-check(pass-at-a-position)\n`);',
        );
        mkdirSync(join(root, 'lint/consumer/rules/expectations'), { recursive: true });
        writeFileSync(
            join(root, 'lint/consumer/rules/expectations/through-the-rule-tester.test.ts'),
            "ruleTester().run('through-the-rule-tester', rule, { invalid: [{ code, errors: [{ column: 0, line: 2, messageId: 'found' }] }], valid: [] });",
        );
        writeFileSync(
            join(root, 'lint/consumer/rules/expectations/hand-rolled-tester.test.ts'),
            "new RuleTester().run('hand-rolled-tester', rule, { invalid: [{ code, errors: [{ line: 2, messageId: 'found' }] }], valid: [] });",
        );
        mkdirSync(join(root, 'specs/lint/report-never-goldened'), { recursive: true });
        writeFileSync(
            join(root, 'specs/lint/report-never-goldened/report-never-goldened.spec.ts'),
            "expect(result.report).not.toMatch('');",
        );
        const rows = [
            row('golden-at-a-position', 'static'),
            row('pass-at-a-position', 'checker'),
            row('through-the-rule-tester', 'static'),
            row('hand-rolled-tester', 'static'),
            row('report-never-goldened', 'static'),
            row('no-spec-at-all', 'checker'),
            row('judged-at-runtime', 'runtime'),
        ];

        // Then - the three proofs pass, the three rows without one are named, and the runtime row is not asked
        expect(unpositionedRules(root, rows)).toStrictEqual([
            'hand-rolled-tester',
            'report-never-goldened',
            'no-spec-at-all',
        ]);
    });
});
