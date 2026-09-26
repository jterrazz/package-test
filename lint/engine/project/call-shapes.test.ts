import { describe, expect, test } from 'vitest';

import { callShapeOf, callsOf, isCallOf } from './call-shapes.js';

function count(probe: string, source: string): number {
    const shape = callShapeOf(probe);
    if (shape === undefined) {
        throw new Error(`${probe} is no call`);
    }
    return callsOf('a.spec.ts', source).filter((call) => isCallOf(call, shape)).length;
}

describe('call-shapes', () => {
    test('the matrix reads a call probe as a shape of the syntax tree — a call counts however a formatter splits it across lines', () => {
        // Given - the same golden call, on one line and split after each paren
        const source = [
            "expect(result.filesystem).toMatch(directory('./expected/tree/'));",
            'expect(result.filesystem).toMatch(',
            '    directory(',
            "        '../../shared/fixtures/a-long-enough-name/that-the-formatter-breaks/',",
            '    ),',
            ');',
        ].join('\n');

        // Then - both are calls of `.toMatch(directory(`
        expect(count('.toMatch(directory(', source)).toBe(2);
    });

    test('the matrix reads a call probe as a shape of the syntax tree — the callee is read as written: bare, a method on any object, a method on one name', () => {
        // Given - a landmark, an accessor of the same name, and one on another subject
        const source = "table('users'); result.table('users'); other.table('users');";

        // Then - each probe finds its own
        expect(count('table(', source)).toBe(1);
        expect(count('.table(', source)).toBe(2);
        expect(count('result.table(', source)).toBe(1);
    });

    test('the matrix reads a call probe as a shape of the syntax tree — the first argument is read as written: a call, a string and its opening, an object, an array', () => {
        // Given - one call of each argument, a type assertion around one
        const source = [
            "api.seed(file('./seeds/a.sql') as never);",
            "api.seed('./seeds/a.sql');",
            `api.get('/users'); api.get(\`/users/\${id}\`); api.get('users');`,
            'api.with({ headers: {} });',
            "expect(result.table('users')).toMatch([[1]]);",
            'expect(rows).toMatch([[1]]);',
        ].join('\n');

        // Then - each shape finds what it names, and nothing else
        expect(count('.seed(file(', source)).toBe(1);
        expect(count(".get('/", source)).toBe(2);
        expect(count('.with({', source)).toBe(1);
        expect(count(')).toMatch([', source)).toBe(1);
    });

    test('the matrix reads a call probe as a shape of the syntax tree — a call written in a string or a comment is no call', () => {
        // Given - the probe named in a comment and a string
        const source = "// api.seed(file('x'))\nconst sample = \"api.seed(file('x'))\";\n";

        // Then - nothing the program calls
        expect(count('.seed(file(', source)).toBe(0);
    });

    test('the matrix reads a call probe as a shape of the syntax tree — a probe with no paren is no call, and one outside the grammar is refused', () => {
        // Given - a key, and a call probe whose argument the grammar does not read
        // Then - the key is left to the literal match; the other throws where it is read
        expect(callShapeOf('services:')).toBeUndefined();
        expect(() => callShapeOf('.seed(42')).toThrow(
            'capability probe .seed(42: no call shape reads the argument `42`',
        );
    });
});
