import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../kit/testing/package-tree.fixtures.js';
import { checkCheckerSuppressionStatesAReason } from '../checker-suppression-states-a-reason.js';

describe('checkCheckerSuppressionStatesAReason', () => {
    test('a directive with no reason after its `--` is found, with the ids it named', () => {
        // Given - a directive with its reason, one with none, one with an empty reason, one that is no directive and one naming nothing
        const root = packageWith({
            'specs/api/users.spec.ts': [
                '// checker-disable-next-line known -- the case',
                'one();',
                '// checker-disable-next-line known, other',
                'two();',
                '// checker-disable-next-line known --',
                'three();',
                '// checker-disable-next-line',
                'four();',
                '// checker-disable-next-line --',
                'five();',
                '',
            ].join('\n'),
        });

        // Then - each directive that says no why, on its line, with the ids it names
        expect(
            checkCheckerSuppressionStatesAReason(root).map(
                ({ fix, found, line, path, rule }) => `${rule} ${path}:${line} ${found} — ${fix}`,
            ),
        ).toStrictEqual([
            'checker-suppression-states-a-reason specs/api/users.spec.ts:3 a checker suppression that does not say why — end the directive with its reason: `checker-disable-next-line known, other -- <why this line is the exception>`',
            'checker-suppression-states-a-reason specs/api/users.spec.ts:5 a checker suppression that does not say why — end the directive with its reason: `checker-disable-next-line known -- <why this line is the exception>`',
            'checker-suppression-states-a-reason specs/api/users.spec.ts:9 a checker suppression that does not say why — end the directive with its reason: `checker-disable-next-line <id> -- <why this line is the exception>`',
        ]);
    });
});
