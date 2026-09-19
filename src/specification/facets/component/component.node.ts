import type { ComponentChain } from './component.types.js';

/**
 * `component`, as node sees it.
 *
 * The chain runs in a page and nowhere else — it mounts into a real document,
 * drives a real pointer and reads a real accessibility tree. Under node the
 * NAME is still published, with the same type, so a `.test.tsx` collected by
 * the wrong project fails on the line that rendered and says what to do,
 * rather than on a missing export or an unresolved `vitest/browser`.
 */
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
    wrap: refuse,
};
