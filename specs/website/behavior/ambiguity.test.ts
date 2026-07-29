import {
    contentinfo,
    link,
    main,
    navigation,
    region,
    type VisitScenario,
    within,
} from '@jterrazz/test';
import { expect, test } from 'vitest';

import { website } from '../website.specification.js';

/** Run a scenario expected to be refused and hand back the refusal text. */
async function refusalOf(path: string, scenario: VisitScenario): Promise<string> {
    try {
        await website.visit(path, scenario);
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
    throw new Error(`expected ${path} to be refused, but the visit succeeded`);
}

test('refuses an element that matches more than one node', async () => {
    // Given - a page where "Articles" names three different links
    const message = await refusalOf('/ambiguous', async (visitor) => {
        // When - a scenario acts on the bare descriptor
        await visitor.click(link('Articles'));
    });

    // Then - the framework refuses rather than picking the first
    expect(message).toContain('link("Articles") matched 3 elements');
});

test('enumerates the candidates and the rewrites that would resolve them', async () => {
    // Given - the same ambiguity
    const message = await refusalOf('/ambiguous', async (visitor) => {
        await visitor.click(link('Articles'));
    });

    // Then - the refusal carries the evidence and the fixes, in the caller's vocabulary
    expect(message).toContain('in <nav>');
    expect(message).toContain('in <footer>');
    expect(message).toContain('within(navigation(), link("Articles"))');
    expect(message).toContain('CONVENTIONS W3');
});

test('resolves the ambiguity when the descriptor is scoped to a landmark', async () => {
    // Given - the same page, the link designated inside the nav
    const result = await website.visit('/ambiguous', async (visitor) => {
        // When - the scope narrows it to exactly one
        await visitor.click(within(navigation(), link('Articles')));
    });

    // Then - the visit lands on the destination
    expect(result.url).toContain('/articles');
});

test('scopes to the footer as readily as to the nav', async () => {
    // Given - the same name in a second landmark
    const result = await website.visit('/ambiguous', async (visitor) => {
        await visitor.click(within(contentinfo(), link('Articles')));
    });

    // Then - the descriptor designates the footer link
    expect(result.url).toContain('/articles');
});

test('narrows on a whole-name match but still refuses what stays ambiguous', async () => {
    // Given - "Read Articles" only matches as a substring
    const message = await refusalOf('/ambiguous', async (visitor) => {
        // When - exact drops it, leaving the two verbatim links
        await visitor.click(link('Articles', { exact: true }));
    });

    // Then - exact alone is not enough here, and the refusal says so
    expect(message).toContain('matched 2 elements');
});

test('searches nested scopes outside-in', async () => {
    // Given - a link inside a named region inside main
    const inSeries = within(region('Series'), link('Part 2'));
    const result = await website.visit('/ambiguous', async (visitor) => {
        await visitor.click(within(main(), inSeries));
    });

    // Then - the chain resolves to the one link in that region
    expect(result.url).toContain('/articles/2');
});

test('sees an element only when it too designates exactly one', async () => {
    // Given - the synchronization primitive on an ambiguous descriptor
    const message = await refusalOf('/ambiguous', async (visitor) => {
        await visitor.see(link('Articles'));
    });

    // Then - see() is held to the same rule as the actions
    expect(message).toContain('matched 3 elements');
});
