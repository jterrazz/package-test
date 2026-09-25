import { component, field, option, selected, within } from '@jterrazz/test';
import type { ElementRef } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { SortField } from './sort-field.js';

/**
 * The option the Sort field is on, scoped to that field. Named rather than
 * written inline: three descriptors inside a verb is one call too deep for
 * `unicorn/max-nested-calls`, and a named Given reads better anyway.
 */
const sortedBy = (name: string): ElementRef => within(field('Sort'), selected(option(name)));

describe('SortField', () => {
    test('names the options a field offers, and the one it is on', async () => {
        // Given - the sort field, read before and after the visitor changes it
        const result = await component.render(<SortField />, async (visitor) => {
            await visitor.see(within(field('Sort'), option('Oldest')));
            await visitor.see(sortedBy('Newest'));
            await visitor.select(field('Sort'), 'oldest');
            await visitor.see(sortedBy('Oldest'));
            await visitor.gone(sortedBy('Newest'));
        });

        // Then - the tree carries the selection the verbs answered about; not one of those options ever had a box on the screen to be seen through
        expect(result.tree.text).toContain('option "Oldest" [selected]');
        expect(result.errors.text).toBe('');
    });
});
