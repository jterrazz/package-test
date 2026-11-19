import type { BoxPoint } from './pointer.js';
import type { Target } from './targets/target.js';

/** The verbs a page is acted on through; every action auto-waits, and `see()` and `gone()` are the synchronization. */
export type VisitorVerbs = {
    check: (target: Target) => Promise<void>;
    click: (target: Target) => Promise<void>;
    /**
     * Press the pointer on the target at `from`, move to `to` in steps, release: both in fractions of the target's box.
     *
     * @example await visitor.drag(testId('week'), { x: 0.05, y: 0.5 }, { x: 0.45, y: 0.5 });
     */
    drag: (target: Target, from: BoxPoint, to: BoxPoint) => Promise<void>;
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
