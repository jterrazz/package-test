import { ruleTester } from '@jterrazz/test';

import { goldenPathHasExtension } from '../golden-path-has-extension.js';

const VIOLATION = '/repo/specs/app/widget/widget.test.ts';

ruleTester().run('golden-path-has-extension', goldenPathHasExtension, {
    invalid: [
        {
            name: 'No extension.',
            code: 'expect(result.stdout).toMatch(file("./__expected__/help"));',
            errors: [{ column: 35, line: 1, messageId: 'missingExtension' }],
            filename: VIOLATION,
        },
        {
            name: 'A path in a subfolder still needs its extension.',
            code: 'expect(result.stdout).toMatch(file("./__expected__/build/verbose"));',
            errors: [{ column: 35, line: 1, messageId: 'missingExtension' }],
            filename: VIOLATION,
        },
    ],
    valid: [
        {
            name: 'An empty path names no file.',
            code: 'expect(result.stdout).toMatch(file(""));',
            filename: VIOLATION,
        },
        {
            name: 'Extension present.',
            code: 'expect(result.stdout).toMatch(file("./__expected__/help.txt"));',
            filename: VIOLATION,
        },
        {
            name: "A tree is the directory matcher's.",
            code: 'await expect(result.directory("out")).toMatch(directory("./__expected__/tree/"));',
            filename: VIOLATION,
        },
        {
            name: "Vitest's toMatch takes a value, and is untouched.",
            code: 'expect(text).toMatch("hello");',
            filename: VIOLATION,
        },
        {
            name: 'Outside specs/ the rule is inert.',
            code: 'expect(text).toMatch(file("./__expected__/substring"));',
            filename: '/repo/src/specification/matching/match.test.ts',
        },
    ],
});
