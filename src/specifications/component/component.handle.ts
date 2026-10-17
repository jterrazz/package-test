import { refusal } from '../../chain/refusals/refusal.js';
import type { ComponentChain } from './component.composition.js';

function refuse(): never {
    throw new Error(
        refusal({
            fix: 'name the file `*.test.tsx`, which the `component` project the tree derives collects and runs in a browser',
            found: 'component, called under node',
            read: 'docs/guides/component-specs.md#the-constructor-there-is-none',
            why: 'A component renders in a browser: under node the page, the pointer and the accessibility tree do not exist.',
        }),
    );
}

/** Present, typed, and refusing: every setup and the terminal action alike. */
export const component: ComponentChain = {
    clock: refuse,
    intercept: refuse,
    render: refuse,
    viewport: refuse,
    wrap: refuse,
};
