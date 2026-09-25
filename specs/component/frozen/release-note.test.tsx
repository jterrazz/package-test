import { component, file, heading } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { ReleaseNote } from './release-note.js';

/** The failure a golden assertion threw, as text — the subject of the test below. */
async function refusalOf(assertion: Promise<void>): Promise<string> {
    return await assertion.then(
        () => 'the frozen golden matched, which the wrong one must never do',
        (error: unknown) => (error instanceof Error ? error.message : String(error)),
    );
}

test('never rewrites a frozen golden, and throws its diff instead', async () => {
    // Given - a golden deliberately claiming a third item the note never draws
    const result = await component.render(<ReleaseNote />, async (visitor) => {
        await visitor.see(heading('Release 17'));
    });

    // Then - it threw its diff, and throws the SAME diff on a second read: a rewrite would have made the second comparison pass, which is exactly what `{ frozen: true }` forbids under TEST_UPDATE=1 (docs/08 § update mode)
    const wrong = `
            - main:
              - region "Release":
                - heading "Release 17" [level=1]
                - list:
                  - listitem: Stubs replace contracts
                  - listitem: Facets are compositions
                  - listitem: Mobile runs on a double`;
    const first = await refusalOf(expect(result.tree).toMatch(wrong, { frozen: true }));
    const second = await refusalOf(expect(result.tree).toMatch(wrong, { frozen: true }));
    expect(first).toContain('Mobile runs on a double');
    expect(second).toBe(first);
});

test('refuses a missing frozen golden, and sends its author to write it by hand', async () => {
    // Given - a note rendered, and a frozen golden nobody has written yet
    const result = await component.render(<ReleaseNote />, async (visitor) => {
        await visitor.see(heading('Release 17'));
    });

    // Then - it fails rather than passes, and never sends the author to TEST_UPDATE=1, a run that writes nothing for a frozen golden
    await expect(
        expect(result.tree).toMatch(file('./expected/absent.aria.yaml'), { frozen: true }),
    ).rejects.toThrow(/does not exist beside this test\.\nThis golden is `\{ frozen \}`/u);
});
