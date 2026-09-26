import { describe, expect, test } from 'vitest';

import { CHECKER_PASS_IDS } from '../checks/checker.js';
import plugin from '../rules/plugin.js';
import { RETIRED_RULES } from './mover.js';
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
    'c8',
    'c9',
    'd10w',
    'd11w',
    'd4',
    'd4b',
    'd5',
    'd5w',
    'e3',
    'e5b',
    'f8',
    'j3w',
    'j4',
    'j5',
    'j9',
];

const PUBLISHED_RULE_IDS = [
    'a1-specification-file',
    'a2-known-constructors',
    'a3-no-destructure-alias',
    'a4-cleanup-afterall',
    'a9w-redundant-root',
    'b10-when-between-markers',
    'b11-marker-one-line',
    'b2-known-fixture-marker',
    'b4-given-then',
    'b6w-redundant-env-url',
    'b8-kebab-trigger',
    'b9w-product-command',
    'c1-domain-structure',
    'c10-contracts-boundary',
    'c11-contract-data-pairing',
    'c13-underscored-ground',
    'c2-http-only-requests',
    'c4-contract-shape',
    'c6-tomatch-extension',
    'c7-seeds-sql-only',
    'c8-referenced-fixture-exists',
    'd12w-response-body-probe',
    'd13w-unfrozen-negative-fixture',
    'd15w-status-only-probe',
    'd16-sampled-oracle',
    'd16w-ambient-value',
    'd17w-double-only-oracle',
    'd18w-existence-only-oracle',
    'd19w-probe-cluster',
    'd2-await-io-matcher',
    'd2w-await-sync-matcher',
    'd6w-transform-token-equivalent',
    'd8w-text-bypass',
    'd9w-single-use-ref',
    'e2-preset-config',
    'e4w-project-binding',
    'e5-no-simulated-dom',
    'e6-component-project-helper',
    'e7w-include-prefix-exists',
    'e8-literate-specification-exists',
    'e9w-env-assignment-in-test',
    'f1-no-subpath-import',
    'f2-no-test-imports-in-prod',
    'f3-specs-public-entry',
    'f4-no-test-to-test-import',
    'f5-fixtures-only-from-tests',
    'f6-no-foreign-test-runtime',
    'g4-no-dom-in-module-test',
    'i1-layer-boundaries',
    'i2-sibling-test-naming',
    'i4-no-module-doubles',
    'j2-no-sleep',
    'j6w-given-in-the-test',
    'w1-scenario-pure',
    'w2-testid-states-what-is-missing',
    'w5w-scenario-settles',
];

describe('names', () => {
    test('the rule map — every old id lands on a rule the plugin registers, and every rule has an old id', () => {
        // Given - the map's targets and the plugin's rules
        const targets = new Set(Object.values(RULE_NAMES));

        // Then - the two sets are one
        expect([...targets].toSorted()).toStrictEqual(Object.keys(plugin.rules).toSorted());
    });

    test('the pass map — every code lands on passes the checker runs, and every pass has a code', () => {
        // Given - the passes the codes name
        const targets = new Set(Object.values(PASS_NAMES).flat());

        // Then - they are the checker's passes, no more and no less
        expect([...targets].toSorted()).toStrictEqual([...CHECKER_PASS_IDS].toSorted());
    });

    test('the pass map — every checker code 16.1.1 published has its passes', () => {
        // Given - the codes a 16.1.1 directive or baseline key can carry
        // Then - none falls through the map
        expect(
            PUBLISHED_CHECKER_CODES.filter((code) => PASS_NAMES[code] === undefined),
        ).toStrictEqual([]);
    });

    test('the rule map — every rule 16.1.1 published is renamed or retired', () => {
        // Given - the ids a 16.1.1 directive, config or baseline key can carry
        // Then - each lands on a name, or is one the mover strips
        expect(
            PUBLISHED_RULE_IDS.filter(
                (id) => RULE_NAMES[id] === undefined && !RETIRED_RULES.includes(id),
            ),
        ).toStrictEqual([]);
    });
});
