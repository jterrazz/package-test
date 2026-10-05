import type { ReactNode } from 'react';

import type { VisitorVerbs } from '../../../visitor/verbs.js';

/** A React tree; `react` is an optional peer, its type kept off a build by `skipLibCheck`. */
export type ComponentUi = ReactNode;

/** A vanilla DOM subject: fills the container, optionally returns its teardown. */
// oxlint-disable-next-line typescript/no-invalid-void-type -- `void` in the union IS the shape: a mount with nothing to tear down is written with no `return` at all, which is what a DOM library's own signature says
export type DomMount = (container: HTMLElement) => (() => void) | void;

/** The verbs a render scenario is handed: a page's, plus the two a parent owns. */
export type ComponentVisitor = VisitorVerbs & {
    rerender: (ui: ComponentUi) => Promise<void>;
    unmount: () => Promise<void>;
};

/** The behaviour of a render; assertions stay in the Then, on the result (`no-expect-in-scenario`). */
export type ComponentScenario = (visitor: ComponentVisitor) => Promise<void>;

/** A React element, or a function that fills a container. */
export type RenderSubject = ComponentUi | DomMount;
