import { describe, expect, test } from 'vitest';

import { resolveComposeBinding, toConstantCase, toKebabCase } from './binding.js';

describe('resolveComposeBinding (CONVENTIONS A6)', () => {
    test('binds to the compose service named exactly like the key', () => {
        // Given - a service named exactly like the record key
        const bound = resolveComposeBinding('db', null, ['db', 'cache']);

        // Then - the exact match wins
        expect(bound).toBe('db');
    });

    test('falls back to the kebab-case conversion of a camelCase key', () => {
        // Given - only the kebab-case service exists
        const bound = resolveComposeBinding('analyticsDb', null, ['db', 'analytics-db']);

        // Then - the camelCase key binds to analytics-db
        expect(bound).toBe('analytics-db');
    });

    test('throws a clear ambiguity error when both names exist', () => {
        // Given - both the exact key and its kebab form name a service
        // Then - the binding is refused, listing both candidates
        expect(() =>
            resolveComposeBinding('analyticsDb', null, ['analyticsDb', 'analytics-db']),
        ).toThrow(/Ambiguous compose binding.*"analyticsDb".*"analytics-db"/s);
    });

    test('composeService escape hatch takes precedence over derivation', () => {
        // Given - an explicit composeService, plus a derivable service present
        const bound = resolveComposeBinding('analyticsDb', 'events-store', [
            'analytics-db',
            'events-store',
        ]);

        // Then - the explicit name wins, no ambiguity is raised
        expect(bound).toBe('events-store');
    });

    test('leaves single-word keys unchanged and falls back to the key', () => {
        // Given - a single-word key with no matching service in the compose file
        const bound = resolveComposeBinding('cache', null, ['db']);

        // Then - the key is kept verbatim (kebab conversion is a no-op)
        expect(bound).toBe('cache');
    });
});

describe('toKebabCase', () => {
    test('splits camelCase boundaries with a dash', () => {
        // Given - a camelCase key
        // Then - camelCase boundaries become kebab-case
        expect(toKebabCase('analyticsDb')).toBe('analytics-db');
    });

    test('leaves a single-word key unchanged', () => {
        // Given - a single-word key
        // Then - it is returned unchanged
        expect(toKebabCase('db')).toBe('db');
    });
});

describe('toConstantCase (CONVENTIONS B6)', () => {
    test('inserts an underscore at camelCase boundaries', () => {
        // Given - a camelCase key
        // Then - the boundary is preserved as CONSTANT_CASE (not ANALYTICSDB)
        expect(toConstantCase('analyticsDb')).toBe('ANALYTICS_DB');
    });

    test('maps existing separators to underscores', () => {
        // Given - a kebab-case key
        // Then - the dash becomes an underscore
        expect(toConstantCase('db-main')).toBe('DB_MAIN');
    });

    test('uppercases a plain single-word key', () => {
        // Given - a plain single-word key
        // Then - it is uppercased unchanged
        expect(toConstantCase('db')).toBe('DB');
    });
});
