import { describe, expect, test } from 'vitest';

import { vitestOnTests } from '../vitest.js';

function optionOf(rule: string): { options: Record<string, string>; severity: unknown } {
    const entry: unknown = { ...vitestOnTests.rules }[rule];
    const pair: unknown[] = Array.isArray(entry) ? entry : [];
    const [severity, options] = pair;
    const named: Record<string, string> = {};
    if (typeof options === 'object' && options !== null) {
        for (const [key, value] of Object.entries(options)) {
            named[key] = String(value);
        }
    }
    return { options: named, severity };
}

describe('vitestOnTests', () => {
    test('the vitest rulebook — the upstream options this vocabulary owns (ADR-005) — `no-vitest-snapshot` — the seven snapshot matchers are refused, each naming the golden', () => {
        // Given - the option the fragment sets on vitest's own rule
        const { options: matchers, severity } = optionOf('vitest/no-restricted-matchers');

        // Then - every matcher vitest offers for snapshots is named, with a destination
        expect(severity).toBe('error');
        expect(Object.keys(matchers).toSorted()).toStrictEqual([
            'toMatchAriaSnapshot',
            'toMatchFileSnapshot',
            'toMatchInlineSnapshot',
            'toMatchScreenshot',
            'toMatchSnapshot',
            'toThrowErrorMatchingInlineSnapshot',
            'toThrowErrorMatchingSnapshot',
        ]);
        expect(
            Object.entries(matchers)
                .filter(([, message]) => message.length === 0)
                .map(([matcher]) => matcher),
        ).toStrictEqual([]);
    });

    test('the vitest rulebook — the upstream options this vocabulary owns (ADR-005) — `no-vitest-time-or-global-stub` — the four vi methods that take a seam, and not the one that restores itself', () => {
        // Given - the option the fragment sets
        const { options: methods, severity } = optionOf('vitest/no-restricted-vi-methods');

        // Then - the clock and the global stub are named; `stubEnv` is sanctioned
        expect(severity).toBe('error');
        expect(Object.keys(methods).toSorted()).toStrictEqual([
            'setSystemTime',
            'stubGlobal',
            'useFakeTimers',
            'useRealTimers',
        ]);
        expect(methods).not.toHaveProperty('stubEnv');
    });

    test('the vitest rulebook — the upstream options this vocabulary owns (ADR-005) — `one-describe-per-file` — the top-level describe keeps the case of the subject it names', () => {
        // Given - the option the fragment sets on vitest's own rule
        const { options, severity } = optionOf('vitest/prefer-lowercase-title');

        // Then - a test title is still lower-cased, the file's describe is not
        expect(severity).toBe('error');
        expect(options).toStrictEqual({ ignoreTopLevelDescribe: 'true' });
    });

    test('the vitest rulebook — the upstream options this vocabulary owns (ADR-005) — `one-describe-level` — one level of describe, and no more', () => {
        // Given - the option the fragment sets on vitest's own rule
        const { options, severity } = optionOf('vitest/max-nested-describe');

        // Then - a second level of context is refused
        expect(severity).toBe('error');
        expect(options).toStrictEqual({ max: '1' });
    });

    test('the vitest rulebook — governs every test file and everything under specs/, so a helper of a spec tree is judged with its specs', () => {
        // Given - the override the fragment sets
        const { files } = vitestOnTests;

        // Then - it names both globs, and only them
        expect(files).toStrictEqual([
            '**/*.{test,spec,test-d,spec-d}.{ts,tsx,js,jsx}',
            '**/specs/**/*.{ts,tsx}',
        ]);
    });
});
