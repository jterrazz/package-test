import { describe, expect, test } from 'vitest';

import { parseProgram } from './parse.js';

describe('parseProgram', () => {
    test('parses a module into the ESTree shape a rule reads', () => {
        // Given - a typed module naming another
        const program = parseProgram(
            'a.ts',
            "import type { A } from './a.js';\nexport const b: A = 1;\n",
        );

        // Then - a program whose first statement carries the specifier as a literal
        expect(program).toMatchObject({
            body: [
                { importKind: 'type', source: { type: 'Literal', value: './a.js' } },
                { type: 'ExportNamedDeclaration' },
            ],
            type: 'Program',
        });
    });

    test('answers nothing for a source that does not parse', () => {
        // Given - a module cut in the middle of a statement
        // Then - no program to walk
        expect(parseProgram('a.ts', 'export const = ;')).toBeUndefined();
    });
});
