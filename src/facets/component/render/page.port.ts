import type { ComponentUi, ComponentVisitor, DomMount } from './scenario.js';

export type MountedSurface = {
    container: HTMLElement;
    rerender: (ui: ComponentUi) => Promise<void>;
    unmount: () => Promise<void>;
};

export type PagePort = {
    readonly afterThisTest: (teardown: () => Promise<void> | void) => void;
    readonly ariaTree: () => Promise<string>;
    readonly mountDom: (mount: DomMount) => Promise<MountedSurface>;
    readonly mountReact: (ui: ComponentUi) => Promise<MountedSurface>;
    readonly projectWrapper: () => ((ui: ComponentUi) => ComponentUi) | undefined;
    readonly visitor: (surface: MountedSurface) => Promise<ComponentVisitor>;
};
