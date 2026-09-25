import { afterThisTest, projectWrapper } from './page-runtime.js';
import type { ComponentUi } from './ui.js';
import { ariaTree, componentVerbs, mountDom, mountReact } from './vitest-browser.adapter.js';

/** The page under Vitest Browser Mode, as a render reaches it: the document, the adapter, the runner. */
export const vitestBrowserPage: {
    readonly afterThisTest: typeof afterThisTest;
    readonly ariaTree: typeof ariaTree;
    readonly mountDom: typeof mountDom;
    readonly mountReact: typeof mountReact;
    readonly projectWrapper: () => ((ui: ComponentUi) => ComponentUi) | undefined;
    readonly visitor: typeof componentVerbs;
} = {
    afterThisTest,
    ariaTree,
    mountDom,
    mountReact,
    projectWrapper: () => projectWrapper<ComponentUi>(),
    visitor: componentVerbs,
};
