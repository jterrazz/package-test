import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { Row } from '../../engine/catalogue/row.js';
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
    test('positions — every static rule proves where it reports (meta-test `every-position-proven`) — each statique and checker row of the catalogue states the line and column of a finding in a spec of its own', () => {
        // Given - every row of both catalogues

        // Then - none is left without a case that pins its position
        expect(unpositionedRules(ROOT, allRows)).toStrictEqual([]);
    });

    test('positions — every static rule proves where it reports (meta-test `every-position-proven`) — a golden naming the rule at a position, or a RuleTester case stating a line, proves it; a bare exit code, a line left unstated or no spec does not, and another channel is not asked', () => {
        // Given - one row per form a proof takes, one per form that is no proof, and a runtime row
        const root = mkdtempSync(join(tmpdir(), 'positions-'));
        mkdirSync(join(root, 'specs/lint/golden-at-a-position'), { recursive: true });
        writeFileSync(
            join(root, 'specs/lint/golden-at-a-position/rejects.spec.yaml'),
            'stdout: |\n    scenario.test.ts:9:5  jterrazz(golden-at-a-position)\n',
        );
        mkdirSync(join(root, 'specs/lint/checker'), { recursive: true });
        writeFileSync(
            join(root, 'specs/lint/checker/pass-at-a-position.test.ts'),
            'specs/a.spec.yaml:1:1: error jterrazz-check(pass-at-a-position): found: …',
        );
        mkdirSync(join(root, 'lint/consumer/rules/expectations'), { recursive: true });
        writeFileSync(
            join(root, 'lint/consumer/rules/expectations/tester-states-a-line.test.ts'),
            "errors: [{ line: 2, messageId: 'found' }]",
        );
        writeFileSync(
            join(root, 'lint/consumer/rules/expectations/tester-states-no-line.test.ts'),
            "errors: [{ messageId: 'found' }]",
        );
        mkdirSync(join(root, 'specs/lint/exit-code-only'), { recursive: true });
        writeFileSync(
            join(root, 'specs/lint/exit-code-only/rejects.spec.yaml'),
            'runs:\n    - command: .\n      exit: 1\n',
        );
        const rows = [
            row('golden-at-a-position', 'statique'),
            row('pass-at-a-position', 'checker'),
            row('tester-states-a-line', 'statique'),
            row('tester-states-no-line', 'statique'),
            row('exit-code-only', 'statique'),
            row('no-spec-at-all', 'checker'),
            row('judged-at-runtime', 'runtime'),
        ];

        // Then - the three proofs pass, the three rows without one are named, and the runtime row is not asked
        expect(unpositionedRules(root, rows)).toStrictEqual([
            'tester-states-no-line',
            'exit-code-only',
            'no-spec-at-all',
        ]);
    });
});
