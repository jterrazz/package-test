import { button, field } from '@jterrazz/test';
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

/** The spelling the line tells the author to write. */
function nameToWriteIn(line: string | undefined): string {
    const found = /The name to write is '(?<name>[^']*)'/u.exec(line ?? '');
    return found?.groups?.name ?? '';
}

test('prints the window line on the stream a plain run shows', async () => {
    // Given - a field named by its label alone, designated by part of that name
    const lines = await linesOf(
        async () =>
            await website.visit('/window', async (visitor) => {
                await visitor.see(field('Journal'));
            }),
    );

    // Then - one line reached the reader, carrying the LABEL the field is named by — its text carries none of it
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(`field('Journal')`);
    expect(lines[0]).toContain('matched only as a SUBSTRING');
    expect(lines[0]).toContain(`The name to write is 'Journal entry'`);
    expect(lines[0]).toContain('gone in 17.0');
});

test('prints the accessible name, and that name resolves when it is written back', async () => {
    // Given - a button whose text glues to "Experiments9" and whose computed name is "Experiments 9"
    const lines = await linesOf(
        async () =>
            await website.visit('/window', async (visitor) => {
                await visitor.see(button('Experiments'));
            }),
    );
    const name = nameToWriteIn(lines[0]);

    // When - the printed spelling is written into a spec, exact as every name is
    const written = await linesOf(
        async () =>
            await website.visit('/window', async (visitor) => {
                await visitor.see(button(name));
            }),
    );

    // Then - it designated the button as a WHOLE name: nothing was widened, and nothing was printed
    expect(name).toBe('Experiments 9');
    expect(written).toHaveLength(0);
});
