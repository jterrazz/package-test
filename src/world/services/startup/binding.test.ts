import { describe, expect, test } from 'vitest';

import { toConstantCase, toKebabCase } from './binding.js';

describe('the two vocabularies a record key feeds', () => {
    test('a service directory under docker/ is the kebab-case of the key', () => {
        // Given - the natural TypeScript spelling of a record key
        // Then - the directory holding its init script is the kebab-case one
        expect(toKebabCase('analyticsDb')).toBe('analytics-db');
        expect(toKebabCase('db')).toBe('db');
    });

    test('an injected environment variable is the CONSTANT_CASE of the key', () => {
        // Given - keys written the three ways a record key is written
        // Then - every non-alphanumeric run collapses to one underscore
        expect(toConstantCase('analyticsDb')).toBe('ANALYTICS_DB');
        expect(toConstantCase('db-main')).toBe('DB_MAIN');
        expect(toConstantCase('db')).toBe('DB');
    });
});
