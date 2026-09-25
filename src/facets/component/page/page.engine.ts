import type { PagePort } from '../render/page.port.js';
import type { ComponentUi } from '../render/scenario.js';
import { afterThisTest, projectWrapper } from './page-runtime.js';
import type { ariaTree, componentVerbs, mountDom, mountReact } from './vitest-browser.adapter.js';

/** What a render reaches through the adapter. */
type Adapter = {
    readonly ariaTree: typeof ariaTree;
    readonly componentVerbs: typeof componentVerbs;
    readonly mountDom: typeof mountDom;
    readonly mountReact: typeof mountReact;
};

/** The adapter, loaded by the first render: it reaches `vitest/browser`, which only a page can load. */
async function adapter(): Promise<Adapter> {
    return await import('./vitest-browser.adapter.js');
}

/** The page under Vitest Browser Mode, as a render reaches it: the document, the adapter, the runner. */
export const vitestBrowserPage: PagePort = {
    afterThisTest,
    ariaTree: async () => {
        const loaded = await adapter();
        return await loaded.ariaTree();
    },
    mountDom: async (mount) => {
        const loaded = await adapter();
        return loaded.mountDom(mount);
    },
    mountReact: async (ui) => {
        const loaded = await adapter();
        return await loaded.mountReact(ui);
    },
    projectWrapper: () => projectWrapper<ComponentUi>(),
    visitor: async (surface) => {
        const loaded = await adapter();
        return loaded.componentVerbs(surface);
    },
};
