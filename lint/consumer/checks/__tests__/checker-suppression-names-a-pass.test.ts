import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import { checkCheckerSuppressionNamesAPass } from '../checker-suppression-names-a-pass.js';

describe('checkCheckerSuppressionNamesAPass', () => {
    test('a directive naming no pass of the checker is found, one finding per unknown id', () => {
        // Given - directives naming a known pass, every pass, and two passes that do not exist
        const root = packageWith({
            'specs/api/users.spec.ts': [
                '// checker-disable-next-line known -- the case',
                'one();',
                '// checker-disable-next-line * -- every pass',
                'two();',
                '// checker-disable-next-line known, gone, lost -- the case',
                'three();',
                '',
            ].join('\n'),
            'specs/api/plain.spec.ts': 'four();\n',
        });

        // Then - each unknown id, on its line
        expect(
            checkCheckerSuppressionNamesAPass(root, ['known']).map(
                ({ fix, found, line, path, rule }) => `${rule} ${path}:${line} ${found} — ${fix}`,
            ),
        ).toStrictEqual([
            'checker-suppression-names-a-pass specs/api/users.spec.ts:5 a checker suppression naming `gone`, which no pass of the checker has — name the pass this line is the exception to, or delete the directive — `gone` silences nothing',
            'checker-suppression-names-a-pass specs/api/users.spec.ts:5 a checker suppression naming `lost`, which no pass of the checker has — name the pass this line is the exception to, or delete the directive — `lost` silences nothing',
        ]);
    });
});
