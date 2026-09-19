import { component, content, testId, within } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { NoisyPanel } from './noisy-panel.js';

test('separates the console errors from the whole stream', async () => {
    // Given - a panel that warns and errors while it mounts
    const result = await component.render(<NoisyPanel />, async (visitor) => {
        await visitor.see(content('Panel'));
    });

    // Then - the full stream carries both, the error stream only the error
    expect(result.console).toContain('[warn] the panel is deprecated');
    expect(result.console).toContain('[error] the panel could not reach the cache');
    expect(result.errors).toContain('the panel could not reach the cache');
});

test('scopes through a test id where the container carries no role', async () => {
    // Given - a panel wrapped in a plain <div>: no landmark, no accessible name
    const result = await component.render(<NoisyPanel />, async (visitor) => {
        // testId: the wrapper is a bare <div> — there is no role and no name to scope on
        await visitor.see(within(testId('panel-body'), content('Panel')));
    });

    // Then - the escape hatch found its anchor, which is an attribute and not
    // Anything a user can see
    expect(result.html).toContain('data-testid="panel-body"');
});
