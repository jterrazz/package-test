import { describe, expect, test } from 'vitest';

import { CaptureScope } from './capture-scope.js';
import { match } from './match.js';
import { structuralEquals, textEquals } from './structural.js';

const UUID_A = '5b3f6e6e-8f5f-4f7e-9c1d-2a6b7c8d9e0f';
const UUID_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('structural', () => {
    test('structural — capture equality — object captures compare by content, not key order', () => {
        // Given - the same object captured twice with different key orders
        const scope = new CaptureScope();
        expect(structuralEquals(match.ref('obj'), { a: 2, b: 1 }, scope)).toBe(true);

        // Then - a re-ordered but structurally identical object is equal
        expect(structuralEquals(match.ref('obj'), { b: 1, a: 2 }, scope)).toBe(true);
        expect(structuralEquals(match.ref('obj'), { a: 2, b: 99 }, scope)).toBe(false);
    });

    test('structural — capture equality — cross-context ref equality: 42 captured from JSON equals "42" from text', () => {
        // Given - a number captured from a JSON context
        const scope = new CaptureScope();
        expect(structuralEquals(match.ref('n'), 42, scope)).toBe(true);

        // Then - the string form captured from a text context is equal
        expect(structuralEquals('{{int#n}}', '42', scope)).toBe(true);
        expect(structuralEquals('{{int#n}}', '43', scope)).toBe(false);
    });

    test('structural — capture equality — a ref is shared across textEquals and structuralEquals on one scope', () => {
        // Given - a uuid captured through a text snapshot comparison
        const scope = new CaptureScope();
        expect(textEquals(`session {{uuid#s}} opened`, `session ${UUID_A} opened`, scope)).toBe(
            true,
        );

        // Then - the same ref constrains a structural comparison on that scope
        expect(structuralEquals({ id: match.ref('s') }, { id: UUID_A }, scope)).toBe(true);
        expect(structuralEquals({ id: match.ref('s') }, { id: UUID_B }, scope)).toBe(false);
    });

    test('structural — capture equality — ref(b, { not: "a" }) works in both directions; a never-captured "a" passes (pinned)', () => {
        // Given - "a" captured first
        const scope = new CaptureScope();
        expect(structuralEquals(match.ref('a'), UUID_A, scope)).toBe(true);

        // Then - b must differ from a, and a-vs-b symmetric usage also holds
        expect(structuralEquals(match.ref('b', { not: 'a' }), UUID_A, scope)).toBe(false);
        expect(structuralEquals(match.ref('b', { not: 'a' }), UUID_B, scope)).toBe(true);
        expect(structuralEquals(match.ref('c', { not: 'b' }), UUID_B, scope)).toBe(false);

        // Then - pinned: { not } against a never-captured ref does not constrain
        const fresh = new CaptureScope();
        expect(structuralEquals(match.ref('b', { not: 'a' }), UUID_A, fresh)).toBe(true);
    });
});
