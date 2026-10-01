import type { Target } from './targets/target.js';

/** The verbs a page is acted on through; every action auto-waits, and `see()` and `gone()` are the synchronization. */
export type VisitorVerbs = {
    check: (target: Target) => Promise<void>;
    click: (target: Target) => Promise<void>;
    fill: (target: Target, value: string) => Promise<void>;
    /** Wait until the element is gone, hidden or never in the document. */
    gone: (target: Target) => Promise<void>;
    hover: (target: Target) => Promise<void>;
    /** Press a key (e.g. `Enter`). */
    press: (key: string) => Promise<void>;
    /** Wait until the element is visible. */
    see: (target: Target) => Promise<void>;
    select: (target: Target, option: string) => Promise<void>;
};
