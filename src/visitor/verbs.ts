import type { Target } from './targets/target.js';

/** The verbs a page is acted on through; every action auto-waits, `see()` is the one synchronization primitive. */
export type VisitorVerbs = {
    check: (element: Target) => Promise<void>;
    click: (element: Target) => Promise<void>;
    fill: (element: Target, value: string) => Promise<void>;
    /** Wait until the element is gone, hidden or never in the document. */
    gone: (element: Target) => Promise<void>;
    hover: (element: Target) => Promise<void>;
    /** Press a key (e.g. `Enter`). */
    press: (key: string) => Promise<void>;
    /** Wait until the element is visible — the only synchronization primitive. */
    see: (element: Target) => Promise<void>;
    select: (element: Target, option: string) => Promise<void>;
};
