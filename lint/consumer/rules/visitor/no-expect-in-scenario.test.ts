import { ruleTester } from '@jterrazz/test';

import { noExpectInScenario } from './no-expect-in-scenario.js';

ruleTester().run('no-expect-in-scenario', noExpectInScenario, {
    invalid: [
        {
            name: 'An assertion inside a website visit scenario.',
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(button('Subscribe'));
                expect(visitor).toBeDefined();
            });`,
            errors: [{ column: 16, line: 3, messageId: 'expectInScenario' }],
        },
        {
            name: 'The mobile twin — `.open()` carries the same scenario grammar.',
            code: `const result = await mobile.open('home', async (visitor) => {
                expect(await visitor.see(content('Welcome'))).toBe(true);
            });`,
            errors: [{ column: 16, line: 2, messageId: 'expectInScenario' }],
        },
        {
            name: 'Two assertions in one scenario are two reports.',
            code: `const result = await website.visit('/', (visitor) => {
                expect(visitor).toBeDefined();
                expect(visitor).not.toBeNull();
            });`,
            errors: [
                { column: 16, line: 2, messageId: 'expectInScenario' },
                { column: 16, line: 3, messageId: 'expectInScenario' },
            ],
        },
    ],
    valid: [
        {
            name: 'The scenario acts; the assertions sit in the Then, on the result.',
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.fill(field('Email'), 'visitor@site.test');
                await visitor.click(button('Subscribe'));
            });
            expect(result.content).toContain('Thanks');`,
        },
        {
            name: 'No scenario callback at all — nothing to keep pure.',
            code: `const result = await website.visit('/');`,
        },
        {
            name: 'A non-scenario terminal action is out of scope.',
            code: `const result = await website.fetch('/', async (visitor) => {
                expect(visitor).toBeDefined();
            });`,
        },
        {
            name: 'A second argument that is not a function is not a scenario.',
            code: `const result = await website.visit('/', options);`,
        },
    ],
});
