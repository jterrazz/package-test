import type { ComponentChain } from './component.facet.js';

function refuse(): never {
    throw new Error(
        'component renders in a browser: collect `*.test.tsx` with the `component()` project ' +
            "(import { component } from '@jterrazz/test/vitest' and add it to `test.projects`). " +
            'Under node the page, the pointer and the accessibility tree do not exist.',
    );
}

/** Present, typed, and refusing — every setup and the terminal action alike. */
export const component: ComponentChain = {
    clock: refuse,
    intercept: refuse,
    render: refuse,
    viewport: refuse,
    wrap: refuse,
};
