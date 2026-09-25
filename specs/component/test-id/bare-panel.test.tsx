import { component, content, testId, within } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { BarePanel } from './bare-panel.js';

describe('BarePanel', () => {
    test('scopes through a test id where the container carries no role', async () => {
        // Given - a panel wrapped in a plain <div>: no landmark, no accessible name
        const result = await component.render(<BarePanel />, async (visitor) => {
            // testId: the wrapper is a bare <div> — there is no role and no name to scope on
            await visitor.see(within(testId('panel-body'), content('Panel')));
        });

        // Then - the escape hatch found its anchor, which is an attribute and not anything a user can see
        expect(result.html.text).toContain('data-testid="panel-body"');
    });
});
