import { button, content, testId, within } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { mobile } from '../mobile.specification.js';

describe('rows', () => {
    test('a Delete two rows carry refuses, naming both', async () => {
        // Given - a scenario tapping a name the drafts screen draws twice
        const opened = mobile.open('specimen://drafts', async (visitor) => {
            await visitor.tap(button('Delete'));
            await visitor.see(content('Draft deleted'));
        });

        // Then - nothing is tapped, and the refusal lists both candidates
        await expect(opened).rejects.toThrow(
            /button\("Delete"\) matched 2 elements on the screen:\n {2}1\. Button "Delete"\n {2}2\. Button "Delete"\n/u,
        );
    });

    test('a Delete scoped to its row deletes that draft', async () => {
        // Given - a visitor on the drafts screen
        const result = await mobile.open('specimen://drafts', async (visitor) => {
            // When - they delete the draft row's entry

            // testId: a row is a container, and iOS gives a container no accessible name
            await visitor.tap(within(testId('draft-row'), button('Delete')));
            await visitor.see(content('Draft deleted'));
        });

        // Then - the draft went, not the archived list
        expect(result.content.text).toBe('Draft deleted');
    });
});
