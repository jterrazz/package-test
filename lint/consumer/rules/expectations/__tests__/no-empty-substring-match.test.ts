import { ruleTester } from '@jterrazz/test';

import { noEmptySubstringMatch } from '../no-empty-substring-match.js';

const SPEC = '/repo/specs/cli/build/build.spec.ts';

ruleTester().run('no-empty-substring-match', noEmptySubstringMatch, {
    invalid: [
        {
            name: 'An empty string, an empty template and a plain string read from a stream, a raw capture or a file.',
            code: [
                "test('t', () => { expect(result.stdout.text).toMatch(''); });",
                'test(\'t\', () => { expect(result.stderr.raw).toMatch(""); });',
                "test('t', () => { expect(result.file('a.txt').content).toMatch(``); });",
            ].join('\n'),
            errors: [
                { column: 18, line: 1, messageId: 'emptySubstring' },
                { column: 18, line: 2, messageId: 'emptySubstring' },
                { column: 18, line: 3, messageId: 'emptySubstring' },
            ],
            filename: SPEC,
        },
    ],
    valid: [
        {
            name: 'The accessor itself is the unrecorded mark update mode fills, and a plain string compared to something is a substring match worth its text.',
            code: [
                "test('t', () => { expect(result.stdout).toMatch(''); });",
                "test('t', () => { expect(result.value).toMatch(``); });",
                "test('t', () => { expect(result.stdout.text).toMatch('built'); });",
                `test('t', () => { expect(result.stdout.text).toMatch(\`a \${name}\`); });`,
                "test('t', () => { expect(result.stdout.text).toMatch(/^$/u); });",
                "test('t', () => { expect(result.stdout.text).toMatch(); });",
                "test('t', () => { expect(result.stdout.text).toBe(''); });",
                "test('t', () => { check(result.stdout.text).toMatch(''); });",
                "test('t', () => { expect(result.stdout.size).toMatch(''); });",
                "test('t', () => { expect(text).toMatch(''); });",
                "test('t', () => { expect().toMatch(''); });",
            ].join('\n'),
            filename: SPEC,
        },
    ],
});
