import type { ReactNode } from 'react';

import type { ElementRef } from '../../../elements/descriptor.js';

/**
 * What a component test hands to `.render()` as a React tree. `react` is an
 * optional peer: a project that specifies no component installs none, and
 * `skipLibCheck` — which every `@jterrazz/typescript` profile sets — keeps the
 * unresolved type off its build.
 */
export type ComponentUi = ReactNode;

/**
 * A vanilla DOM subject: a function handed the container it must fill. Its
 * optional return is the teardown, the way a DOM library states one.
 */
// oxlint-disable-next-line typescript/no-invalid-void-type -- `void` in the union IS the shape: a mount with nothing to tear down is written with no `return` at all, which is what a DOM library's own signature says
export type DomMount = (container: HTMLElement) => (() => void) | void;

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
