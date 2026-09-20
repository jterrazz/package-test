import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { w2TestIdStatesWhatIsMissing } from './w2-testid-states-what-is-missing.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

/** A website spec — the file kind a scenario is written in. */
const SPEC = '/repo/specs/website/home/subscribe.spec.ts';

ruleTester.run(
    'w2-testid-states-what-is-missing',
    w2TestIdStatesWhatIsMissing as unknown as OxlintRule,
    {
        invalid: [
            // The escape hatch with nothing stated about it.
            {
                code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(testId('subscribe-cta'));
            });`,
                errors: 1,
                filename: SPEC,
            },
            // The mobile twin — `.open()` carries the same element vocabulary.
            {
                code: `const result = await mobile.open('home', async (visitor) => {
                await visitor.tap(testId('cta'));
            });`,
                errors: 1,
                filename: SPEC,
            },
            // One report per unexplained escape, scoping included.
            {
                code: `const result = await website.visit('/', async (visitor) => {
                await visitor.fill(within(testId('form'), field('Email')), 'a@b.test');
                await visitor.click(testId('subscribe-cta'));
            });`,
                errors: 2,
                filename: SPEC,
            },
            // A comment that names no invariant is not a statement.
            {
                code: `const result = await website.visit('/', async (visitor) => {
                // testId:
                await visitor.click(testId('subscribe-cta'));
            });`,
                errors: 1,
                filename: SPEC,
            },
            // A comment two lines up is out of the window: it reads as being
            // About something else.
            {
                code: `const result = await website.visit('/', async (visitor) => {
                // testId: the widget renders no accessible name
                await visitor.fill(field('Email'), 'a@b.test');
                await visitor.click(testId('subscribe-cta'));
            });`,
                errors: 1,
                filename: SPEC,
            },
        ],
        valid: [
            // User-facing elements only.
            {
                code: `const result = await website.visit('/', async (visitor) => {
                await visitor.fill(field('Email'), 'visitor@site.test');
                await visitor.click(button('Subscribe'));
            });`,
                filename: SPEC,
            },
            // The hatch, with the invariant stated on its own line.
            {
                code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(testId('subscribe-cta')); // testId: the third-party widget renders no accessible name
            });`,
                filename: SPEC,
            },
            // The same invariant on the line ABOVE — the form a consumer with
            // `eslint/no-inline-comments` armed has to write.
            {
                code: `const result = await website.visit('/', async (visitor) => {
                // testId: the third-party widget renders no accessible name
                await visitor.click(testId('subscribe-cta'));
            });`,
                filename: SPEC,
            },
            // Outside a scenario the helper is not the rule's subject.
            { code: `const element = testId('subscribe-cta');`, filename: SPEC },
            // A non-scenario terminal action is out of scope.
            {
                code: `const result = await website.fetch('/', async (visitor) => {
                await visitor.click(testId('cta'));
            });`,
                filename: SPEC,
            },
        ],
    },
);
