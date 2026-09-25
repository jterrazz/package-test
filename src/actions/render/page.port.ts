import type { ComponentUi, DomMount } from '../../seams/vitest-browser/ui.js';
import type { MountedSurface } from '../../seams/vitest-browser/vitest-browser.adapter.js';
import type { ComponentVisitor } from './scenario.js';

/** The page a render mounts into — the only way `.render()` reaches the document and the runner. */
export type PagePort = {
    /** Run `teardown` when the current test ends, however it ends. */
    readonly afterThisTest: (teardown: () => Promise<void> | void) => void;
    /** The ARIA snapshot of the rendered body. */
    readonly ariaTree: () => Promise<string>;
    /** Mount a vanilla DOM subject into a fresh container. */
    readonly mountDom: (mount: DomMount) => MountedSurface;
    /** Mount a React tree, through the optional adapter loaded on first use. */
    readonly mountReact: (ui: ComponentUi) => Promise<MountedSurface>;
    /** The frame the project dresses every render in, when it states one. */
    readonly projectWrapper: () => ((ui: ComponentUi) => ComponentUi) | undefined;
    /** The verbs a scenario drives the mounted surface with. */
    readonly visitor: (surface: MountedSurface) => ComponentVisitor;
};
