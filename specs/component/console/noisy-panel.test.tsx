import { component, content } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { NoisyPanel } from './noisy-panel.js';

describe('NoisyPanel', () => {
    test('separates the console errors from the whole stream', async () => {
        // Given - a panel that warns and errors while it mounts
        const result = await component.render(<NoisyPanel />, async (visitor) => {
            await visitor.see(content('Panel'));
        });

        // Then - the full stream carries both, the error stream only the error
        expect(result.console.text).toContain('[warn] the panel is deprecated');
        expect(result.console.text).toContain('[error] the panel could not reach the cache');
        expect(result.errors.text).toContain('the panel could not reach the cache');
    });

    test('an empty stream is an empty text: toBeEmpty refuses a stream in the page too', async () => {
        // Given - a render, whose console is a stream
        const result = await component.render(<NoisyPanel />, async (visitor) => {
            await visitor.see(content('Panel'));
        });

        // Then - a table's matcher handed the console is refused by the type, and by the run naming the form to write
        // @ts-expect-error -- toBeEmpty is a table's matcher, and a stream is no table
        await expect(expect(result.console).toBeEmpty()).rejects.toThrow(
            /an empty stream is an empty text\n.*\nfix: compare its text: expect\(<result>\.console\.text\)\.toBe\(''\)/u,
        );
    });
});
