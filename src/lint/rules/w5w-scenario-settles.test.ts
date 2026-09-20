import { asOxlintRule, ruleTester } from '../rule-tester.fixtures.js';
import { w5wScenarioSettles } from './w5w-scenario-settles.js';

const SPEC = '/repo/specs/website/posts/table.spec.ts';
const COMPONENT = '/repo/src/web/post-table.test.tsx';

ruleTester().run('w5w-scenario-settles', asOxlintRule(w5wScenarioSettles), {
    invalid: [
        // The capture is taken on whatever the click left on the screen.
        {
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(button('Next'));
            });`,
            errors: [{ messageId: 'unsettled' }],
            filename: SPEC,
        },
        // A fill that settles nothing.
        {
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.see(heading('Posts'));
                await visitor.fill(field('Search'), 'draft');
            });`,
            errors: [{ messageId: 'unsettled' }],
            filename: SPEC,
        },
        // The component facet hands the same visitor to the same callback.
        {
            code: `const result = await component.render(<Table />, async (visitor) => {
                await visitor.click(button('Next'));
            });`,
            errors: [{ messageId: 'unsettled' }],
            filename: COMPONENT,
        },
    ],
    valid: [
        // The action names what it produced.
        {
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(button('Next'));
                await visitor.see(heading('Page 2'));
            });`,
            filename: SPEC,
        },
        // Or what it removed.
        {
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(button('Dismiss'));
                await visitor.gone(dialog('Welcome'));
            });`,
            filename: SPEC,
        },
        // A scenario that only reads has nothing in flight.
        {
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.see(heading('Posts'));
            });`,
            filename: SPEC,
        },
        // A mobile scenario speaks the same two verbs.
        {
            code: `const result = await mobile.open('home', async (visitor) => {
                await visitor.tap(button('Next'));
                await visitor.see(content('Page 2'));
            });`,
            filename: '/repo/specs/mobile/home/home.spec.ts',
        },
    ],
});
