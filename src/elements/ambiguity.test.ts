import { describe, expect, test } from 'vitest';

import { REFUSAL_WHY } from '../../lint/engine/catalogue/refusal.js';
import { describeAmbiguity } from './ambiguity.js';
import type { ElementMatch } from './descriptor.js';
import { link, navigation, within } from './elements.js';

const match = (overrides: Partial<ElementMatch> = {}): ElementMatch => ({
    tag: 'a',
    text: 'Articles',
    ...overrides,
});

describe('ambiguity', () => {
    test('describeAmbiguity — names the descriptor, the count and the page', () => {
        // Given - three candidates for one link
        const message = describeAmbiguity({
            element: link('Articles'),
            matches: [match(), match({ text: 'Read Articles' }), match()],
            url: 'http://site.test/',
        });

        // Then - the headline carries all three facts
        expect(message).toContain('link("Articles") matched 3 elements on http://site.test/');
    });

    test('describeAmbiguity — enumerates every candidate with its tag, detail and landmark', () => {
        // Given - candidates sitting in different landmarks
        const message = describeAmbiguity({
            element: link('Articles'),
            matches: [
                match({ context: 'nav', detail: '/articles' }),
                match({ context: 'footer', detail: '/articles' }),
            ],
            url: 'http://site.test/',
        });

        // Then - each line is readable without opening a browser
        expect(message).toContain('1. <a href="/articles">Articles</a>  in <nav>');
        expect(message).toContain('2. <a href="/articles">Articles</a>  in <footer>');
    });

    test('describeAmbiguity — suggests scoping to a landmark the candidates actually sit in', () => {
        // Given - candidates in a nav and a footer
        const message = describeAmbiguity({
            element: link('Articles'),
            matches: [match({ context: 'nav' }), match({ context: 'footer' })],
            url: 'http://site.test/',
        });

        // Then - the suggestion is copy-pasteable, counted, and names the alternative
        expect(message).toContain('within(navigation(), link("Articles"))');
        expect(message).toContain('leaves 1 of 2');
        expect(message).toContain('also here: contentinfo()');
    });

    test('describeAmbiguity — offers a named section as the region it is, and an unnamed one as nothing', () => {
        // Given - candidates in two named sections, one reached by its role, and one in an unnamed section
        const message = describeAmbiguity({
            element: link('Articles'),
            matches: [
                match({ context: 'section', contextName: 'Orders' }),
                match({ context: 'region', contextName: 'Returns' }),
                match({ context: 'section' }),
            ],
            url: 'http://site.test/',
        });

        // Then - each region is offered by its name, and the unnamed section never
        expect(message).toContain(
            'within(region("Orders"), link("Articles"))   [leaves 1 of 3]   [also here: region("Returns")]',
        );
        expect(message).not.toContain('region()');
    });

    test('describeAmbiguity — does not offer a landmark that holds every candidate', () => {
        // Given - two candidates in the same main
        const message = describeAmbiguity({
            element: link('Articles'),
            matches: [match({ context: 'main' }), match({ context: 'main' })],
            url: 'http://site.test/',
        });

        // Then - scoping there would leave the spec exactly as ambiguous
        expect(message).not.toContain('within(main()');
        expect(message).toContain('within(<a container holding only this one>');
    });

    test('describeAmbiguity — names the accessible name when it is not the text that was matched', () => {
        // Given - a row button labelled by an aria-label, beside a dialog button
        const message = describeAmbiguity({
            element: link('Delete post'),
            matches: [
                match({ accessibleName: 'Delete Post a', tag: 'button', text: 'Delete' }),
                match({ tag: 'button', text: 'Delete post' }),
            ],
            url: 'http://site.test/',
        });

        // Then - the evidence names what the descriptor actually matched on
        expect(message).toContain('named "Delete Post a"');
    });

    test('describeAmbiguity — offers exact to a descriptor that opted OUT, with what it leaves', () => {
        // Given - `{ exact: false }`, which is the only way a substring candidate is in the set at all
        const message = describeAmbiguity({
            element: link('Articles', { exact: false }),
            matches: [match(), match({ text: 'Read Articles' })],
            url: 'http://site.test/',
        });

        // Then - the remaining count keeps the suggestion honest
        expect(message).toContain('link("Articles", { exact: true })');
        expect(message).toContain('leaves 1 of 2');
    });

    test('describeAmbiguity — never offers exact to an ordinary descriptor — it is already exact', () => {
        // Given - a descriptor stating nothing, which is the whole-name default
        const message = describeAmbiguity({
            element: link('Articles'),
            matches: [match(), match({ text: 'Read Articles' })],
            url: 'http://site.test/',
        });

        // Then - telling it to match the name whole would be telling it to do what it is already doing
        expect(message).not.toContain('exact name');
    });

    test('describeAmbiguity — omits the exact suggestion when every candidate matches the name whole', () => {
        // Given - two identical names, where exact would change nothing
        const message = describeAmbiguity({
            element: link('Articles'),
            matches: [match(), match()],
            url: 'http://site.test/',
        });

        // Then - no suggestion that would leave the spec just as ambiguous
        expect(message).not.toContain('exact: true');
    });

    test('describeAmbiguity — does not re-suggest scoping a descriptor that is already scoped', () => {
        // Given - an ambiguity inside an existing scope
        const message = describeAmbiguity({
            element: within(navigation(), link('Articles')),
            matches: [match({ context: 'nav' }), match({ context: 'nav' })],
            url: 'http://site.test/',
        });

        // Then - scoping is not offered again; the other routes remain
        expect(message).not.toContain('scope it');
        expect(message).toContain('other element');
    });

    test('describeAmbiguity — states the rule and where it is documented', () => {
        // Given - any refusal
        const message = describeAmbiguity({
            element: link('Articles'),
            matches: [match(), match()],
            url: 'http://site.test/',
        });

        // Then - an agent reading the failure reads the rule, and where it is whole
        expect(message).toContain(`why: ${REFUSAL_WHY['descriptor-matches-one-element']}`);
        expect(message).toContain('read: docs/19-linting.md#descriptor-matches-one-element');
    });
});
