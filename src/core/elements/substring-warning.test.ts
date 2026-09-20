import { beforeEach, describe, expect, test, vi } from 'vitest';

import { resetSubstringWarnings, warnSubstringOnly } from './substring-warning.js';

describe('the transitional warning for a name that only matched in part', () => {
    beforeEach(() => {
        resetSubstringWarnings();
    });

    test('names the descriptor, the fixes, and the two releases it ships for', () => {
        // Given - a descriptor that designated nothing as a whole name
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        warnSubstringOnly({ kind: 'link', name: 'Articles' }, 'http://localhost/ambiguous');

        // Then - the reader has the descriptor, all three ways out, and the deadline
        const [line] = warn.mock.calls.map(([first]) => String(first));
        expect(line).toContain(`link('Articles')`);
        expect(line).toContain('matched only as a SUBSTRING');
        expect(line).toContain('{ exact: false }');
        expect(line).toContain('16.0 and 16.1');
        expect(line).toContain('http://localhost/ambiguous');
    });

    test('says it once per descriptor — a scenario run ten times has one thing to fix', () => {
        // Given - the same descriptor reported three times
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const element = { kind: 'link' as const, name: 'Articles' };

        // Then - only the first one prints
        expect(warnSubstringOnly(element, 'a')).toBe(true);
        expect(warnSubstringOnly(element, 'a')).toBe(false);
        expect(warnSubstringOnly(element, 'b')).toBe(false);
    });

    test('tells two descriptors apart by their scope chain, not just their name', () => {
        // Given - the same name, one of them scoped to a landmark
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const bare = { kind: 'link' as const, name: 'Articles' };
        const scoped = { ...bare, scope: { kind: 'navigation' as const } };

        // Then - each is its own thing to fix, so each is reported
        expect(warnSubstringOnly(bare, 'a')).toBe(true);
        expect(warnSubstringOnly(scoped, 'a')).toBe(true);
    });
});
