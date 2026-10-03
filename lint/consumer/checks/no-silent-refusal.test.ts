import { describe, expect, test } from 'vitest';

import { parseSpecDocument } from '../../kit/project/spec-document.js';
import { checkNoSilentRefusal } from './no-silent-refusal.js';

describe('checkNoSilentRefusal', () => {
    test('a run that fails with neither stream written is found at its command', () => {
        // Given - a silent success, a silent failure, and failures stating stdout or stderr
        const document = parseSpecDocument(
            [
                'description: refuses out loud',
                'runs:',
                '    - command: ok',
                '      exit: 0',
                '    - command: silent',
                '      exit: 2',
                '    - command: told',
                '      exit: 1',
                '      stdout: "no"',
                '    - command: warned',
                '      exit: 1',
                '      stderr: "no"',
                '',
            ].join('\n'),
            'case.spec.yaml',
        );

        // Then - the silent failure, with the exit it gave
        expect(
            checkNoSilentRefusal(document).map(
                ({ fix, found, line, rule }) => `${rule} ${line} ${found} — ${fix}`,
            ),
        ).toStrictEqual([
            'no-silent-refusal 5 `exit: 2` with no `stdout:` and no `stderr:` — write the words the refusal printed under `stderr:` (or `stdout:`)',
        ]);
    });
});
