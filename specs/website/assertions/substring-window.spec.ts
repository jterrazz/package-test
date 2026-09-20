import { field } from '@jterrazz/test';
import { expect, test, vi } from 'vitest';

import { website } from '../website.specification.js';

/**
 * The window's lines printed during one visit.
 *
 * Read off `process.stderr`, because that is the one stream vitest's default
 * reporter passes through: a line printed with `console.warn` is captured and
 * dropped, and the run that fired it shows nothing at all.
 *
 * A descriptor is reported once per PROCESS, so every test here names its own.
 */
async function linesOf(visit: () => Promise<unknown>): Promise<string[]> {
    const lines: string[] = [];
    const written = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
        lines.push(String(chunk));
        return true;
    });
    try {
        await visit();
    } finally {
        written.mockRestore();
    }
    return lines.filter((line) => line.includes('@jterrazz/test:'));
}

test('prints the window line on the stream a plain run shows', async () => {
    // Given - a field named by its label alone, designated by part of that name
    const lines = await linesOf(
        async () =>
            await website.visit('/window', async (visitor) => {
                await visitor.see(field('Journal'));
            }),
    );

    // Then - one line reached the reader, naming the descriptor and the deadline
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(`field('Journal')`);
    expect(lines[0]).toContain('matched only as a SUBSTRING');
    expect(lines[0]).toContain('gone in 17.0');
});
