import { asOxlintRule, ruleTester } from '../../../engine/testing/rule-tester.fixtures.js';
import { goldenPathHasExtension } from './golden-path-has-extension.js';

const VIOLATION = '/repo/specs/app/widget/widget.test.ts';

ruleTester().run('golden-path-has-extension', asOxlintRule(goldenPathHasExtension), {
    invalid: [
        // No extension.
        {
            code: 'expect(result.stdout).toMatch(file("./_expected/help"));',
            errors: 1,
            filename: VIOLATION,
        },
        // A path in a subfolder still needs its extension.
        {
            code: 'expect(result.stdout).toMatch(file("./_expected/build/verbose"));',
            errors: 1,
            filename: VIOLATION,
        },
    ],
    valid: [
        // Extension present.
        {
            code: 'expect(result.stdout).toMatch(file("./_expected/help.txt"));',
            filename: VIOLATION,
        },
        // A tree is the directory matcher's.
        {
            code: 'await expect(result.directory("out")).toMatch(directory("./_expected/tree/"));',
            filename: VIOLATION,
        },
        // Vitest's toMatch takes a value, and is untouched.
        { code: 'expect(text).toMatch("hello");', filename: VIOLATION },
        // Outside specs/ the rule is inert.
        {
            code: 'expect(text).toMatch(file("./_expected/substring"));',
            filename: '/repo/src/specification/matching/match.test.ts',
        },
    ],
});
