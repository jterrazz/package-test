import { component, content } from '@jterrazz/test';
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
