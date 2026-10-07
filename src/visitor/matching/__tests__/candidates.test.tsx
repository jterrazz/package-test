import { describe, expect, test } from 'vitest';

import { CANDIDATE_LIMITS, candidatesOf, MATCH_TEXT_LENGTH } from '../candidates.js';

function nodesOf(html: string, selector: string): Element[] {
    document.body.innerHTML = html;
    return [...document.querySelectorAll(selector)];
}

describe('candidates', () => {
    test('candidatesOf — names a section by the text its aria-labelledby points at', () => {
        // Given - a button inside a section labelled by its heading
        const nodes = nodesOf(
            '<section aria-labelledby="orders-title"><h2 id="orders-title"> Your   orders </h2><button>Remove</button></section>',
            'button',
        );

        // Then - the landmark is the section, named by the heading's text
        expect(candidatesOf(nodes, CANDIDATE_LIMITS)).toStrictEqual([
            {
                accessibleName: undefined,
                context: 'section',
                contextName: 'Your orders',
                detail: undefined,
                tag: 'button',
                text: 'Remove',
            },
        ]);
    });

    test('candidatesOf — reads the landmark by its role before its tag', () => {
        // Given - a link inside a div that declares itself a navigation
        const nodes = nodesOf(
            '<div role="navigation"><span><a href="/articles">Articles</a></span></div>',
            'a',
        );

        // Then - the context is the role, and the link's href is its detail
        expect(candidatesOf(nodes, CANDIDATE_LIMITS)[0]).toMatchObject({
            context: 'navigation',
            detail: '/articles',
            tag: 'a',
        });
    });

    test('candidatesOf — keeps no accessible name for an empty aria-label', () => {
        // Given - a button whose aria-label is blank
        const nodes = nodesOf('<button aria-label="  ">Save</button>', 'button');

        // Then - the text alone names it
        expect(candidatesOf(nodes, CANDIDATE_LIMITS)[0]?.accessibleName).toBeUndefined();
    });

    test('candidatesOf — cuts a long text at the length every surface lists', () => {
        // Given - a button whose text outruns a candidate line
        const nodes = nodesOf(`<button>${'a'.repeat(MATCH_TEXT_LENGTH + 20)}</button>`, 'button');

        // Then - the text stops at the shared length
        expect(candidatesOf(nodes, CANDIDATE_LIMITS)[0]?.text).toHaveLength(MATCH_TEXT_LENGTH);
    });
});
