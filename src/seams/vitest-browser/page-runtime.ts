import { inject, onTestFinished, vi } from 'vitest';
import { page } from 'vitest/browser';

/**
 * The runner, as the page reaches it.
 *
 * `vitest` is the framework's one sanctioned coupling and it lives in the
 * layers that own a runner — `src/vitest/` for the config side, this seam for
 * the page's. The component model asks for "after this test", "pin the clock"
 * and "what did the project provide" and never learns which runner answers.
 */

/** Run `teardown` when the current test ends, however it ends. No hook in the spec. */
export function afterThisTest(teardown: () => Promise<void> | void): void {
    onTestFinished(teardown);
}

/**
 * Freeze the page's `Date` at `iso`. `Date` ONLY: faking the page's timers
 * would stop React's scheduler and nothing would ever render.
 */
export function pinClock(iso: string): void {
    vi.useFakeTimers({ now: new Date(iso), toFake: ['Date'] });
}

/** Give the page its real clock back. */
export function releaseClock(): void {
    vi.useRealTimers();
}

/** The instant `component({ clock })` pinned for every render, if it did. */
export function providedClock(): string | undefined {
    return inject('componentClock');
}

/** The page size the project states — what a per-test `.viewport()` is restored to. */
export function providedViewport(): { height: number; width: number } {
    return inject('componentViewport');
}

/** Resize the page the test renders into. */
export async function setViewport(size: { height: number; width: number }): Promise<void> {
    await page.viewport(size.width, size.height);
}

/**
 * The project's `wrap`, left on `globalThis` by the setup module the project
 * loads. A shared symbol rather than an import: the setup module and this
 * bundle are two graphs in one page and share no module instance.
 */
export function projectWrapper<Ui>(): ((ui: Ui) => Ui) | undefined {
    const key = Symbol.for('@jterrazz/test:component-wrap');
    const holder = globalThis as Record<symbol, ((ui: Ui) => Ui) | undefined>;
    const wrap = holder[key];
    return typeof wrap === 'function' ? wrap : undefined;
}

/** What the project hands the page, declared where the page reads it. */
declare module 'vitest' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- a module augmentation MERGES only as an interface; a type alias redeclares the name and every member is lost
    interface ProvidedContext {
        /** The instant `component({ clock })` pins for every render. */
        componentClock?: string;
        /** The page size `component({ viewport })` states — the size a test is restored to. */
        componentViewport: { height: number; width: number };
        /** `TEST_UPDATE=1` / `-u`, read on the server and handed to the page. */
        update?: boolean;
    }
}
