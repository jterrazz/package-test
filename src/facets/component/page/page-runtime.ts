import { inject, onTestFinished, vi } from 'vitest';

import { instantOf } from '../../../clock/instant.js';

export function pageDirectory(): string {
    return '';
}

export function afterThisTest(teardown: () => Promise<void> | void): void {
    onTestFinished(teardown);
}

/** `Date` only: faking the page's timers would stop React's scheduler. */
export function pinClock(iso: string): void {
    vi.useFakeTimers({ now: instantOf('at', iso), toFake: ['Date'] });
}

export function releaseClock(): void {
    vi.useRealTimers();
}

export function providedClock(): string | undefined {
    return inject('componentClock');
}

export function providedViewport(): { height: number; width: number } {
    return inject('componentViewport');
}

/** `vitest/browser` loads in a page alone, so it is reached only when a size is set. */
export async function setViewport(size: { height: number; width: number }): Promise<void> {
    const { page } = await import('vitest/browser');
    await page.viewport(size.width, size.height);
}

/** A shared symbol rather than an import: the setup module and this bundle are two graphs in one page. */
export function projectWrapper<Ui>(): ((ui: Ui) => Ui) | undefined {
    const key = Symbol.for('@jterrazz/test:component-wrap');
    const holder = globalThis as Record<symbol, ((ui: Ui) => Ui) | undefined>;
    const wrap = holder[key];
    return typeof wrap === 'function' ? wrap : undefined;
}

declare module 'vitest' {
    interface ProvidedContext {
        /** The instant `component({ clock })` pins for every render. */
        componentClock?: string;
        /** The page size `component({ viewport })` states — the size a test is restored to. */
        componentViewport: { height: number; width: number };
        /** `TEST_UPDATE=1` / `-u`, read on the server and handed to the page. */
        update?: boolean;
    }
}
