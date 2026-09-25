import { describe, expect, test } from 'vitest';

import plugin from './plugin.js';
import selfPlugin, { selfRules } from './self-plugin.js';

describe('the self plugin — the static rules only this package runs', () => {
    test('every rule it registers is a self row, and none of the published plugin', () => {
        // Given - the self plugin's rules
        for (const [id, rule] of Object.entries(selfPlugin.rules)) {
            // Then - each declares the self audience, and the published plugin does not carry it too
            expect({ [id]: rule.meta.docs.audience }).toStrictEqual({ [id]: 'self' });
            expect(id in plugin.rules, `${id} is published as well`).toBe(false);
        }
    });

    test('its rule set names every rule under its own namespace, at its severity', () => {
        // Given - the rules this repository's config spreads
        // Then - one entry per rule, `jterrazz-self/<rule>`, an error unless the id is advisory
        expect(selfRules).toStrictEqual({ 'jterrazz-self/f7-no-framework-internals': 'error' });
        expect(selfPlugin.meta.name).toBe('jterrazz-self');
    });
});
