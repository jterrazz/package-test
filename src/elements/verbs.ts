import type { ElementRef } from './descriptors/element.js';

/** The verbs a page is acted on through; every action auto-waits, `see()` is the one synchronization primitive. */
export type PageVerbs = {
    check: (element: ElementRef) => Promise<void>;
    click: (element: ElementRef) => Promise<void>;
    fill: (element: ElementRef, value: string) => Promise<void>;
    /** Wait until the element is gone, hidden or never in the document. */
    gone: (element: ElementRef) => Promise<void>;
    hover: (element: ElementRef) => Promise<void>;
    /** Press a key (e.g. `Enter`). */
    press: (key: string) => Promise<void>;
    /** Wait until the element is visible — the only synchronization primitive. */
    see: (element: ElementRef) => Promise<void>;
    select: (element: ElementRef, option: string) => Promise<void>;
};
