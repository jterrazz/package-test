import { describe, expect, test } from 'vitest';

import { http } from '../kinds/http.js';
import { intercept } from './intercept.capability.js';

describe('intercept', () => {
    test('intercept.capability — .intercept() — asks the network to accept before it appends, and refuses a bare request in its own words', () => {
        // Given - a network that records each acceptance
        const accepted: string[] = [];
        const setup = {
            adapters: {
                network: {
                    accepts: () => {
                        accepted.push('accepts');
                    },
                    arm: async () => await Promise.resolve({}),
                },
            },
            config: {},
        };
        const request = http.get('https://weather.test/today');

        // When - an inline pair is stated, then a request alone
        const stubs = intercept.reduce(intercept.initial, [request, http.json({ c: 1 })], setup);

        // Then - the network asked, the pair appended, and the bare request refused by its call
        expect([accepted, stubs.length]).toStrictEqual([['accepts'], 1]);
        expect(() => intercept.reduce(stubs, [request], setup)).toThrow(
            /^found: \.intercept\(request\), a bare request with no response/u,
        );
    });
});
