import { ruleTester } from '@jterrazz/test';

import { testIdStatesWhatIsMissing } from './test-id-states-what-is-missing.js';

const SPEC = '/repo/specs/website/home/subscribe.spec.ts';

ruleTester().run('test-id-states-what-is-missing', testIdStatesWhatIsMissing, {
    invalid: [
        {
            name: 'A scenario written as a function is walked too.',
            code: `const result = await website.visit('/', async function (visitor) {
                await visitor.click(testId('cta'));
            });`,
            errors: [{ column: 36, line: 2, messageId: 'unexplainedTestId' }],
            filename: SPEC,
        },
        {
            name: 'A string that reads like the statement states nothing, nor does a comment saying it about something else.',
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(testId('cta'), '// testId: in a string'); // see testId: elsewhere
            });`,
            errors: [{ column: 36, line: 2, messageId: 'unexplainedTestId' }],
            filename: SPEC,
        },
        {
            name: 'The escape hatch with nothing stated about it.',
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(testId('subscribe-cta'));
            });`,
            errors: [{ column: 36, line: 2, messageId: 'unexplainedTestId' }],
            filename: SPEC,
        },
        {
            name: 'The mobile twin — `.open()` carries the same element vocabulary.',
            code: `const result = await mobile.open('home', async (visitor) => {
                await visitor.tap(testId('cta'));
            });`,
            errors: [{ column: 34, line: 2, messageId: 'unexplainedTestId' }],
            filename: SPEC,
        },
        {
            name: 'One report per unexplained escape, scoping included.',
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.fill(within(testId('form'), field('Email')), 'a@b.test');
                await visitor.click(testId('subscribe-cta'));
            });`,
            errors: [
                { column: 42, line: 2, messageId: 'unexplainedTestId' },
                { column: 36, line: 3, messageId: 'unexplainedTestId' },
            ],
            filename: SPEC,
        },
        {
            name: 'A comment that names no invariant is not a statement.',
            code: `const result = await website.visit('/', async (visitor) => {
                // testId:
                await visitor.click(testId('subscribe-cta'));
            });`,
            errors: [{ column: 36, line: 3, messageId: 'unexplainedTestId' }],
            filename: SPEC,
        },
        {
            name: 'A comment two lines up is out of the window: it reads as being about something else.',
            code: `const result = await website.visit('/', async (visitor) => {
                // testId: the widget renders no accessible name
                await visitor.fill(field('Email'), 'a@b.test');
                await visitor.click(testId('subscribe-cta'));
            });`,
            errors: [{ column: 36, line: 4, messageId: 'unexplainedTestId' }],
            filename: SPEC,
        },
    ],
    valid: [
        {
            name: 'A block comment states it too, and so does a function scenario.',
            code: `const result = await website.visit('/', async function (visitor) {
                /* testId: the widget renders no accessible name */
                await visitor.click(testId('subscribe-cta'));
            });`,
            filename: SPEC,
        },
        {
            name: 'Production code is not judged, and a scenario that is no function holds nothing to walk.',
            code: `const result = await website.visit('/', wrap(() => visitor.click(testId('x'))));\nawait website.visit('/');`,
            filename: SPEC,
        },
        {
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(testId('subscribe-cta'));
            });`,
            filename: '/repo/src/home.ts',
        },
        {
            name: 'User-facing elements only.',
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.fill(field('Email'), 'visitor@site.test');
                await visitor.click(button('Subscribe'));
            });`,
            filename: SPEC,
        },
        {
            name: 'The hatch, with the invariant stated on its own line.',
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(testId('subscribe-cta')); // testId: the third-party widget renders no accessible name
            });`,
            filename: SPEC,
        },
        {
            name: 'The same invariant on the line ABOVE — the form a consumer with `eslint/no-inline-comments` armed has to write.',
            code: `const result = await website.visit('/', async (visitor) => {
                // testId: the third-party widget renders no accessible name
                await visitor.click(testId('subscribe-cta'));
            });`,
            filename: SPEC,
        },
        {
            name: "Outside a scenario the helper is not the rule's subject.",
            code: `const element = testId('subscribe-cta');`,
            filename: SPEC,
        },
        {
            name: 'A non-scenario terminal action is out of scope.',
            code: `const result = await website.fetch('/', async (visitor) => {
                await visitor.click(testId('cta'));
            });`,
            filename: SPEC,
        },
    ],
});
