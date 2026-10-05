import { ruleTester } from '@jterrazz/test';

import { scenarioEndsSettled } from './scenario-ends-settled.js';

const SPEC = '/repo/specs/website/posts/table.spec.ts';
const COMPONENT = '/repo/src/web/post-table.test.tsx';

ruleTester().run('scenario-ends-settled', scenarioEndsSettled, {
    invalid: [
        {
            name: 'A then whose continuation does nothing settles nothing.',
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(button('Next')).then(() => {});
            });`,
            errors: [{ column: 22, line: 2, messageId: 'unsettled' }],
            filename: SPEC,
        },
        {
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(button('Next')).then();
            });`,
            errors: [{ column: 22, line: 2, messageId: 'unsettled' }],
            filename: SPEC,
        },
        {
            name: 'The capture is taken on whatever the click left on the screen.',
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(button('Next'));
            });`,
            errors: [{ column: 22, line: 2, messageId: 'unsettled' }],
            filename: SPEC,
        },
        {
            name: 'A fill that settles nothing.',
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.see(heading('Posts'));
                await visitor.fill(field('Search'), 'draft');
            });`,
            errors: [{ column: 22, line: 3, messageId: 'unsettled' }],
            filename: SPEC,
        },
        {
            name: 'A specification spec that has not taken the suffix yet is the same scenario.',
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(button('Next'));
            });`,
            errors: [{ column: 22, line: 2, messageId: 'unsettled' }],
            filename: '/repo/specs/website/posts/table.test.ts',
        },
        {
            name: 'A scenario ending on a loop full of clicks settles nothing either.',
            code: `const result = await website.visit('/', async (visitor) => {
                for (const tab of ['drafts', 'live']) {
                    await visitor.click(button(tab));
                }
            });`,
            errors: [{ column: 26, line: 3, messageId: 'unsettled' }],
            filename: SPEC,
        },
    ],
    valid: [
        {
            name: 'A switch whose every case reads, a wait in the tail of a then, and one branch that reads, settle it.',
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(button('Next'));
                switch (step) {
                    case 1:
                        await visitor.see(heading('One'));
                        break;
                    default:
                        await visitor.see(heading('Other'));
                }
            });
            await website.visit('/', async (visitor) => {
                await visitor.click(button('Next')).then(() => visitor.see(heading('Two')));
            });
            await website.visit('/', async (visitor) => {
                if (a) {
                    await visitor.click(button('Next'));
                } else {
                    await visitor.see(heading('Three'));
                }
            });`,
            filename: SPEC,
        },
        {
            name: 'A wait in the tail of a then written as a function settles it too.',
            code: `await website.visit('/', async (visitor) => {
                await visitor.click(button('Next')).then(function () {
                    return visitor.see(heading('Two'));
                });
            });`,
            filename: SPEC,
        },
        {
            name: "Another receiver's action, a scenario that neither acts nor reads, a callback with no visitor, a call that is no scenario, and a module outside specs/ are none of this rule's.",
            code: `await website.visit('/', async (visitor) => {
                await other.click(button('Next'));
            });
            await website.visit('/', async (visitor) => {
                await visitor.wait(1);
            });
            await website.visit('/', async () => {
                await click(button('Next'));
            });
            await website.fetch('/', async (visitor) => {
                await visitor.click(button('Next'));
            });`,
            filename: SPEC,
        },
        {
            code: `await website.visit('/', async (visitor) => {
                await visitor.click(button('Next'));
            });`,
            filename: '/repo/src/home.test.ts',
        },
        {
            code: `await website.visit('/', async (visitor) => {
                await visitor.click(button('Next'));
            });`,
            filename: '/repo/specs/website/_setup/visits.ts',
        },
        {
            name: 'The action names what it produced.',
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(button('Next'));
                await visitor.see(heading('Page 2'));
            });`,
            filename: SPEC,
        },
        {
            name: 'Or what it removed.',
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(button('Dismiss'));
                await visitor.gone(dialog('Welcome'));
            });`,
            filename: SPEC,
        },
        {
            name: 'A scenario that only reads has nothing in flight.',
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.see(heading('Posts'));
            });`,
            filename: SPEC,
        },
        {
            name: 'A mobile scenario speaks the same two verbs.',
            code: `const result = await mobile.open('home', async (visitor) => {
                await visitor.tap(button('Next'));
                await visitor.see(content('Page 2'));
            });`,
            filename: '/repo/specs/mobile/home/home.spec.ts',
        },
        {
            name: 'The wait is at the end of the loop the scenario ends on.',
            code: `const result = await website.visit('/', async (visitor) => {
                for (const tab of ['drafts', 'live']) {
                    await visitor.click(button(tab));
                    await visitor.see(content(tab + ' panel'));
                }
            });`,
            filename: SPEC,
        },
        {
            name: 'Both branches name what they produced.',
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
        {
            name: 'Nothing is left to see once the tree is gone.',
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(button('Close'));
                await visitor.unmount();
            });`,
            filename: SPEC,
        },
        {
            name: 'A read-only scenario whose Given fills a table and an array.',
            code: `const result = await website.visit('/', async (visitor) => {
                await db.select('posts');
                const rows = new Array(3).fill(0);
                await visitor.see(content(rows.length + ' posts'));
            });`,
            filename: SPEC,
        },
        {
            name: "A component's action often produces a CALL, which `see()` cannot name.",
            code: `const result = await component.render(<Table />, async (visitor) => {
                await visitor.click(button('Save'));
            });`,
            filename: COMPONENT,
        },
        {
            name: 'Out of reach beside a module, wherever the scenario came from.',
            code: `const result = await website.visit('/', async (visitor) => {
                await visitor.click(button('Next'));
            });`,
            filename: '/repo/src/domain/order.test.ts',
        },
    ],
});
