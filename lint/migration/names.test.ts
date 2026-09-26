import { describe, expect, test } from 'vitest';

import { CHECKER_PASS_IDS } from '../checks/checker.js';
import plugin from '../rules/plugin.js';
import { PASS_NAMES, RULE_NAMES } from './names.js';

const PUBLISHED_CHECKER_CODES = [
    'a7',
    'b5',
    'c12',
    'c14',
    'c15',
    'c16',
    'c18',
    'c20',
    'c21w',
    'c23',
    'c9',
    'd10w',
    'd4',
    'd4b',
    'd5',
    'e3',
    'e5b',
    'f8',
    'j4',
    'j9',
];

describe('names', () => {
    test('RULE_NAMES — every old id lands on a rule the plugin registers, and every rule has an old id', () => {
        // Given - the map's targets and the plugin's rules
        const targets = new Set(Object.values(RULE_NAMES));

        // Then - the two sets are one
        expect([...targets].toSorted()).toStrictEqual(Object.keys(plugin.rules).toSorted());
    });

    test('PASS_NAMES — every code lands on passes the checker runs, and every pass has a code', () => {
        // Given - the passes the codes name
        const targets = new Set(Object.values(PASS_NAMES).flat());

        // Then - they are the checker's passes, no more and no less
        expect([...targets].toSorted()).toStrictEqual([...CHECKER_PASS_IDS].toSorted());
    });

    test('PASS_NAMES — every checker code 16.1.1 published has its passes', () => {
        // Given - the codes a 16.1.1 directive or baseline key can carry
        // Then - none falls through the map
        expect(
            PUBLISHED_CHECKER_CODES.filter((code) => PASS_NAMES[code] === undefined),
        ).toStrictEqual([]);
    });
});
