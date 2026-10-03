import { describe, expect, test } from 'vitest';

import { navigation, within } from '../targets/landmarks.js';
import { button, link } from '../targets/roles.js';
import type { Target } from '../targets/target.js';
import { ambiguousTargetError } from './ambiguous.js';
import type { ElementMatch } from './candidates.js';

const match = (overrides: Partial<ElementMatch> = {}): ElementMatch => ({
    tag: 'a',
    text: 'Articles',
    ...overrides,
});

const OTHER =
    '  • other element  a heading(), button() or field() may name one thing where this does not';

/** The fixes a refusal offers, one line each. */
function fixesOf(target: Target, matches: ElementMatch[]): string[] {
    const lines = ambiguousTargetError({ matches, target, url: 'http://site.test/' }).message.split(
        '\n',
    );
    return lines.slice(lines.indexOf('fix: designate one of them:') + 1, -1);
}

const scope = (target: string): string =>
    `  • scope it       within(<a container holding only this one>, ${target})`;

describe('ambiguous', () => {
    test('ambiguousTargetError — names the target, the count and the page, then every candidate as it reads, the rule and where it is documented', () => {
        // Given - candidates with a href, a name, an accessible name, an empty one, a landmark and an empty context
        const { message } = ambiguousTargetError({
            matches: [
                match({ context: 'nav', detail: '/articles' }),
                match({ detail: 'q', tag: 'input', text: '' }),
                match({
                    accessibleName: 'Delete Post a',
                    context: '',
                    tag: 'button',
                    text: 'Delete',
                }),
                match({ accessibleName: '', text: 'Read Articles' }),
            ],
            target: link('Articles'),
            url: 'http://site.test/',
        });

        // Then - the whole refusal, readable without opening a browser
        expect(message).toBe(
            [
                'found: Ambiguous element: link("Articles") matched 4 elements on http://site.test/ —',
                '  1. <a href="/articles">Articles</a>  in <nav>',
                '  2. <input name="q"></input>',
                '  3. <button>Delete</button>  named "Delete Post a"',
                '  4. <a>Read Articles</a>',
                'why: A verb acts on exactly ONE element: a target that matches several is refused, never settled by the first.',
                'fix: designate one of them:',
                '  • scope it       within(navigation(), link("Articles"))   [leaves 1 of 4]',
                OTHER,
                'read: docs/24-linting.md#target-matches-one-element',
            ].join('\n'),
        );
    });

    test('ambiguousTargetError — scoping offers the landmark leaving the fewest first, a named region by its name, never one holding every candidate, and nothing to a scoped target', () => {
        // Given - candidates across landmarks, in named and unnamed sections, all in one main, and under a scope already
        const sections = [
            match({ context: 'section', contextName: 'Orders' }),
            match({ context: 'region', contextName: 'Returns' }),
            match({ context: 'region', contextName: 'Returns' }),
            match({ context: 'section' }),
        ];

        const scoped = within(navigation(), link('Articles'));

        // Then - each scoping offer
        expect([
            fixesOf(link('Articles'), [
                match({ context: 'nav' }),
                match({ context: 'nav' }),
                match({ context: 'footer' }),
                match({ context: 'aside' }),
                match(),
            ]),
            fixesOf(link('Articles'), sections),
            fixesOf(link('Articles'), [match({ context: 'main' }), match({ context: 'main' })]),
            fixesOf(scoped, [match({ context: 'nav' }), match({ context: 'nav' })]),
        ]).toStrictEqual([
            [
                '  • scope it       within(contentinfo(), link("Articles"))   [leaves 1 of 5]   [also here: complementary(), navigation()]',
                OTHER,
            ],
            [
                '  • scope it       within(region("Orders"), link("Articles"))   [leaves 1 of 4]   [also here: region("Returns")]',
                OTHER,
            ],
            [
                '  • scope it       within(<a container holding only this one>, link("Articles"))',
                OTHER,
            ],
            [OTHER],
        ]);
    });

    test('ambiguousTargetError — offers exact only to a target that opted out, and only when it leaves some of the candidates but not all', () => {
        // Given - a target that opted out over a mix, over whole matches only, over substring matches only, and an ordinary one over a mix
        const loose = button('Articles', { exact: false });
        const mixed = [match(), match({ text: 'Read Articles' }), match({ text: 'Read Articles' })];

        // Then - the suggestion, with what it leaves, for the first alone
        expect([
            fixesOf(loose, mixed),
            fixesOf(loose, [match(), match()]),
            fixesOf(loose, [match({ text: 'All Articles' }), match({ text: 'Read Articles' })]),
            fixesOf(button('Articles'), mixed),
        ]).toStrictEqual([
            [
                scope('button("Articles", { exact: false })'),
                '  • exact name     button("Articles", { exact: true })   [leaves 1 of 3]',
                OTHER,
            ],
            [scope('button("Articles", { exact: false })'), OTHER],
            [scope('button("Articles", { exact: false })'), OTHER],
            [scope('button("Articles")'), OTHER],
        ]);
    });
});
