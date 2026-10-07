import { describe, expect, test } from 'vitest';

import { driverReason } from '../driver-reason.js';

describe('driverReason', () => {
    test.each([
        ['a message', new Error('connection reset'), 'connection reset'],
        [
            'a code under an empty message',
            Object.assign(new AggregateError([], 'refused'), { code: 'ECONNREFUSED', message: '' }),
            'ECONNREFUSED',
        ],
        ['neither, as a string', 'socket hang up', 'socket hang up'],
        ['an empty code, as a string', { code: '' }, '[object Object]'],
        ['nothing at all, as a string', null, 'null'],
    ])('driverReason — reads %s', (_case, error, reason) => {
        // Given - what a driver threw
        // Then - the reason a refusal prints
        expect(driverReason(error)).toBe(reason);
    });
});
