import type { ElementRef } from '../../../elements/descriptor.js';
import type { ComponentUi, DomMount } from '../page/ui.js';

/**
 * The interaction vocabulary a render scenario is handed — the When: the verbs
 * a rendered surface shares with a page, plus the two a parent owns.
 */
export type ComponentVisitor = {
    check: (element: ElementRef) => Promise<void>;
    click: (element: ElementRef) => Promise<void>;
    fill: (element: ElementRef, value: string) => Promise<void>;
    gone: (element: ElementRef) => Promise<void>;
    hover: (element: ElementRef) => Promise<void>;
    press: (key: string) => Promise<void>;
    rerender: (ui: ComponentUi) => Promise<void>;
    see: (element: ElementRef) => Promise<void>;
    select: (element: ElementRef, option: string) => Promise<void>;
    unmount: () => Promise<void>;
};

/** The behaviour of a render; assertions stay in the Then, on the result (W1). */
export type ComponentScenario = (visitor: ComponentVisitor) => Promise<void>;

/**
 * What `.render()` mounts. A React tree is an element (`<PostTable />`); a
 * vanilla DOM subject is the FUNCTION that fills a container, which is how a
 * DOM-only module is called in production too.
 */
export type RenderSubject = ComponentUi | DomMount;
