import { button, contentinfo, link, main, navigation, region, within } from '@jterrazz/test';
import type { VisitScenario } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { website } from '../website.specification.js';

async function refusalOf(path: string, scenario: VisitScenario): Promise<string> {
    try {
        await website.visit(path, scenario);
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
    throw new Error(`expected ${path} to be refused, but the visit succeeded`);
}

// RUNTIME target-matches-one-element — a target a verb ACTS on must designate exactly one element; the refusal enumerates the candidates and the rewrites.
describe('ambiguity', () => {
    test('refuses an element that matches more than one node', async () => {
        // Given - a page where "Articles" names two links verbatim, and a third only as a substring ("Read Articles"), which the whole-name default does not reach
        const message = await refusalOf('/ambiguous', async (visitor) => {
            // When - a scenario acts on the bare target
            await visitor.click(link('Articles'));
        });

        // Then - the framework refuses rather than picking the first
        expect(message).toContain('link("Articles") matched 2 elements');
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
        expect(message).toContain('read: docs/24-linting.md#target-matches-one-element');
    });

    test('names a candidate inside a `<search>` element by its landmark', async () => {
        // Given - a "Go" button inside the page's `<search>` and another in its `<main>`
        const message = await refusalOf('/search', async (visitor) => {
            await visitor.click(button('Go'));
        });

        // Then - the element's landmark is evidence, and its scope a rewrite
        expect(message).toContain('in <search>');
        expect(message).toContain('within(search(), button("Go"))');
    });

    test('offers a named `<section>` as the region it is, by its name', async () => {
        // Given - a "Remove" button in a section named by its label, one named by its heading, one in an unnamed section
        const message = await refusalOf('/regions', async (visitor) => {
            await visitor.click(button('Remove'));
        });

        // Then - each named section is a region() rewrite, and the unnamed one is evidence only
        expect(message).toContain('in <section>');
        expect(message).toContain(
            'within(region("Orders"), button("Remove"))   [leaves 1 of 3]   [also here: region("Returns")]',
        );
    });

    test('names the landmark a candidate sits in past a role that is not one', async () => {
        // Given - a "Home" link in a `role="list"` inside the nav, and another in the footer
        const message = await refusalOf('/listed', async (visitor) => {
            await visitor.click(link('Home'));
        });

        // Then - the list is passed over: the nav is the evidence and the scope
        expect(message).toContain('in <nav>');
        expect(message).not.toContain('in <list>');
        expect(message).toContain('within(navigation(), link("Home"))');
    });

    test('resolves the ambiguity when the target is scoped to a landmark', async () => {
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

        // Then - the target designates the footer link
        expect(result.url).toContain('/articles');
    });

    test('a name only part of an accessible name designates nothing', async () => {
        // Given - "Read Articles" is on the page, and no element is named "Read" whole
        const result = await website.visit('/ambiguous', async (visitor) => {
            await visitor.gone(link('Read'));
        });

        // Then - exact names: the partial name found nothing, and the page still carries the longer one
        expect(result.content.text).toContain('Read Articles');
    });

    test('the opt-out brings the substring match back, and widens the ambiguity', async () => {
        // Given - the same page, with substring matching asked for explicitly
        const message = await refusalOf('/ambiguous', async (visitor) => {
            // When - `{ exact: false }` lets "Read Articles" answer to "Articles" again
            await visitor.click(link('Articles', { exact: false }));
        });

        // Then - the third link answers too, which is what the substring form costs
        expect(message).toContain('matched 3 elements');
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
        // Given - the synchronization primitive on an ambiguous target
        const message = await refusalOf('/ambiguous', async (visitor) => {
            await visitor.see(link('Articles'));
        });

        // Then - see() is held to the same rule as the actions
        expect(message).toContain('matched 2 elements');
    });

    test('names the accessible name a target matched on when it is not the text', async () => {
        // Given - a row button labelled by an aria-label, and a dialog button named verbatim: one target, two matches, and only one of them reads as itself
        const message = await refusalOf('/ambiguous', async (visitor) => {
            await visitor.click(button('Delete post'));
        });

        // Then - the evidence names what actually matched, not the text it shows
        expect(message).toContain('matched 2 elements');
        expect(message).toContain('named "Delete post"');
    });
});
