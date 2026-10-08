import { describe, expect, test } from 'vitest';

import { dedent } from '../../../../lint/kit/project/dedent.js';
import { renderRows, renderText, renderValue } from '../render.js';

function readRendered(rendered: string): string {
    const quoted: unknown = rendered.startsWith('"') ? JSON.parse(rendered) : undefined;
    if (typeof quoted === 'string') {
        return quoted;
    }
    return rendered.slice(1, -1).replaceAll(/\\(?<escaped>[\\`$])/gu, '$<escaped>');
}

describe('render', () => {
    test.each([
        ['a line', 'built'],
        ['lines ending on a break', 'HTTP/1.1 200 OK\n\n{"ok": true}\n'],
        ['lines with no final break', 'first\nlast'],
        ['a text opening on a break', '\nafter a blank line\n'],
        ['a backtick, a backslash and a hole', `a \`b\` \\n \${c}\n`],
        ['every line indented', '  a\n  b\n'],
    ])('the value written in place reads back as the value — %s', (_name, text) => {
        // Given - the text rendered at an indentation, and read as a test would
        const read = readRendered(renderText(text, '        '));

        // Then - dedented, it is the text again
        expect(dedent(read)).toBe(text);
    });

    test('the value written in place reads back as the value — a text of one line is one template, of several a block indented under the call', () => {
        // Given - texts of one line, of lines ending on a break, and of lines with none
        // Then - each rendering, whole
        expect(['one', 'a\nb\n', 'a\n\nb'].map((text) => renderText(text, '    '))).toStrictEqual([
            '`one`',
            '`\n        a\n        b\n    `',
            '`\n        a\n\n        b`',
        ]);
    });

    test('the value written in place reads back as the value — a json value and rows are written as code indented with the call', () => {
        // Given - a value and rows at an indentation
        // Then - one line per row, the closing bracket on the call's column
        expect(renderValue({ id: '{{uuid}}', tags: ['a'] }, '    ')).toBe(
            '{\n        "id": "{{uuid}}",\n        "tags": [\n            "a"\n        ]\n    }',
        );
        expect(
            renderRows(
                [
                    [1, 'Ada', null],
                    [2, undefined],
                ],
                '    ',
            ),
        ).toBe('[\n        [1, "Ada", null],\n        [2, null],\n    ]');
        expect(renderRows([], '    ')).toBe('[]');
    });

    test('renderValue — an integer of five digits or more is written in groups of three, as the linter asks, and nothing else is', () => {
        // Given - a value holding large and small integers, a float, and a string of digits
        const value = {
            at: 1_775_034_000_000,
            count: 9999,
            debt: -12_345,
            ratio: 12_345.5,
            text: '12345',
        };

        // Then - only the large integers are grouped, and the string keeps its digits
        expect(renderValue(value, '')).toBe(
            '{\n    "at": 1_775_034_000_000,\n    "count": 9999,\n    "debt": -12_345,\n    "ratio": 12345.5,\n    "text": "12345"\n}',
        );
        expect(renderRows([[10_000, 'a']], '')).toBe('[\n    [10_000, "a"],\n]');
    });
});
