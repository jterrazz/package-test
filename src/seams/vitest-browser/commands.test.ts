import { describe, expect, test, vi } from 'vitest';

import { COMPONENT_COMMANDS, notify } from './commands.js';

/** A command is called with the provider's context; `notify` reads none of it. */
const NO_CONTEXT = {} as Parameters<typeof notify>[0];

describe('the commands a page reaches the node side through', () => {
    test('notify writes the page`s line on stderr, where the reporter shows it', () => {
        // Given - a line the page had for whoever is running the suite
        const written = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
        notify(NO_CONTEXT, '@jterrazz/test: a name matched only as a SUBSTRING');

        // Then - it is on the one stream vitest passes through, terminated as a line
        expect(written).toHaveBeenCalledWith(
            '@jterrazz/test: a name matched only as a SUBSTRING\n',
        );
    });

    test('the registered list is what the page can call, and nothing else', () => {
        // Given - the record `component()` hands to the browser project
        // Then - the four things a page cannot do for itself are there
        expect(Object.keys(COMPONENT_COMMANDS).toSorted()).toStrictEqual([
            'ariaNode',
            'ariaTree',
            'goldenRead',
            'goldenWrite',
            'notify',
        ]);
    });
});
