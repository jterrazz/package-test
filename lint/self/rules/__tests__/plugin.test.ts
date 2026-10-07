import { describe, expect, test } from 'vitest';

import plugin from '../../../consumer/rules/plugin.js';
import selfPlugin, { selfPluginRules } from '../plugin.js';

describe('selfPlugin', () => {
    test('the self plugin — the static rules only this package runs — every rule it registers is a self row, and none of the published plugin', () => {
        // Given - the self plugin's rules
        const rules = Object.entries(selfPlugin.rules);
        expect(rules.length).toBeGreaterThan(0);

        // Then - each declares the self audience, and the published plugin does not carry it too
        expect(
            rules
                .filter(([id, rule]) => rule.meta.docs.audience !== 'self' || id in plugin.rules)
                .map(([id]) => id),
        ).toStrictEqual([]);
    });

    test('the self plugin — the static rules only this package runs — its rule set names every rule under its own namespace, as an error', () => {
        // Given - the rules this repository's config spreads
        // Then - one entry per rule, `jterrazz-self/<rule>`, an error
        expect(selfPluginRules).toStrictEqual({
            'jterrazz-self/specification-is-a-composition': 'error',
        });
        expect(selfPlugin.meta.name).toBe('jterrazz-self');
    });
});
