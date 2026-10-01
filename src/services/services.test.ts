import { describe, expect, test } from 'vitest';

import { postgres } from './postgres/postgres.adapter.js';
import { redis } from './redis/redis.adapter.js';
import { declaredDatabaseKeys } from './services.js';

describe('declaredDatabaseKeys', () => {
    test('names the keys whose handles are databases, in the order the record declares them', () => {
        // Given - a record mixing a cache between two databases
        const services = { analyticsDb: postgres(), cache: redis(), db: postgres() };

        // Then - the cache is left out, and the first database stays first (`database-named-only-when-several`'s default)
        expect(declaredDatabaseKeys(services)).toStrictEqual(['analyticsDb', 'db']);
    });
});
