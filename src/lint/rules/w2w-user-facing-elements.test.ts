import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { w2wUserFacingElements } from './w2w-user-facing-elements.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('w2w-user-facing-elements', w2wUserFacingElements as unknown as OxlintRule, {
    invalid: [
        // The escape hatch inside a website visit scenario.
        {
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(testId('subscribe-cta'));
            });`,
            errors: 1,
        },
        // The mobile twin — `.open()` carries the same element vocabulary.
        {
            code: `const result = await mobile.open('home', async (visitor) => {
                await visitor.tap(testId('cta'));
            });`,
            errors: 1,
        },
        // One report per escape, scoping included.
        {
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.fill(within(testId('form'), field('Email')), 'a@b.test');
                await visitor.click(testId('subscribe-cta'));
            });`,
            errors: 2,
        },
    ],
    valid: [
        // User-facing elements only.
        {
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.fill(field('Email'), 'visitor@site.test');
                await visitor.click(button('Subscribe'));
            });`,
        },
        // Outside a scenario the helper is not the rule's subject.
        { code: `const element = testId('subscribe-cta');` },
        // A non-scenario terminal action is out of scope.
        {
            code: `const result = await website.fetch('/', async (visitor) => {
                await visitor.click(testId('cta'));
            });`,
        },
    ],
});
