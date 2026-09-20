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
        // A scenario ending on a loop full of clicks settles nothing either.
        {
            code: `const result = await website.visit('/', async (visitor) => {
                for (const tab of ['drafts', 'live']) {
                    await visitor.click(button(tab));
                }
            });`,
            errors: [{ messageId: 'unsettled' }],
            filename: SPEC,
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
        // The wait is at the end of the loop the scenario ends on.
        {
            code: `const result = await website.visit('/', async (visitor) => {
                for (const tab of ['drafts', 'live']) {
                    await visitor.click(button(tab));
                    await visitor.see(content(tab + ' panel'));
                }
            });`,
            filename: SPEC,
        },
        // Both branches name what they produced.
        {
            code: `const result = await website.visit('/', async (visitor) => {
                if (wide) {
                    await visitor.click(button('Next'));
                    await visitor.see(heading('Page 2'));
                } else {
                    await visitor.click(button('More'));
                    await visitor.see(content('Page 2'));
                }
            });`,
            filename: SPEC,
        },
        // Nothing is left to see once the tree is gone.
        {
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(button('Close'));
                await visitor.unmount();
            });`,
            filename: SPEC,
        },
        // A read-only scenario whose Given fills a table and an array.
        {
            code: `const result = await website.visit('/', async (visitor) => {
                await db.select('posts');
                const rows = new Array(3).fill(0);
                await visitor.see(content(rows.length + ' posts'));
            });`,
            filename: SPEC,
        },
        // A component's action often produces a CALL, which `see()` cannot name.
        {
            code: `const result = await component.render(<Table />, async (visitor) => {
                await visitor.click(button('Save'));
            });`,
            filename: COMPONENT,
        },
    ],
});
