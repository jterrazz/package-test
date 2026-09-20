import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { w1ScenarioPure } from './w1-scenario-pure.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('w1-scenario-pure', w1ScenarioPure as unknown as OxlintRule, {
    invalid: [
        // An assertion inside a website visit scenario.
        {
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(button('Subscribe'));
                expect(visitor).toBeDefined();
            });`,
            errors: 1,
        },
        // The mobile twin — `.open()` carries the same scenario grammar.
        {
            code: `const result = await mobile.open('home', async (visitor) => {
                expect(await visitor.see(content('Welcome'))).toBe(true);
            });`,
            errors: 1,
        },
        // Two assertions in one scenario are two reports.
        {
            code: `const result = await website.visit('/', (visitor) => {
                expect(visitor).toBeDefined();
                expect(visitor).not.toBeNull();
            });`,
            errors: 2,
        },
    ],
    valid: [
        // The scenario acts; the assertions sit in the Then, on the result.
        {
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.fill(field('Email'), 'visitor@site.test');
                await visitor.click(button('Subscribe'));
            });
            expect(result.content).toContain('Thanks');`,
        },
        // No scenario callback at all — nothing to keep pure.
        { code: `const result = await website.visit('/');` },
        // A non-scenario terminal action is out of scope.
        {
            code: `const result = await website.fetch('/', async (visitor) => {
                expect(visitor).toBeDefined();
            });`,
        },
        // A second argument that is not a function is not a scenario.
        { code: `const result = await website.visit('/', options);` },
    ],
});
