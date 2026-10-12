import type { BrowserLinkElement, BrowserMetaElement } from './browser.port.js';
import type { StorageState } from './storage.capability.js';

// invariant: every function here is serialised into the page by Playwright, where the helpers an instrumented copy calls do not exist: the file is out of the mutation run, and each function closes over nothing.

export type PageExtraction = {
    html: string;
    jsonLdBlocks: string[];
    links: BrowserLinkElement[];
    metas: BrowserMetaElement[];
    text: string;
    title: string;
};

// invariant: runs in the page: what a visit reads off the rendered document.
export function extractPage(): PageExtraction {
    const links = [...document.querySelectorAll('link')].map((link) => ({
        href: link.href,
        hreflang: link.hreflang || undefined,
        rel: link.rel,
        type: link.type || undefined,
    }));
    const metas = [...document.querySelectorAll('meta')].map((meta) => ({
        content: meta.content,
        name: meta.name || undefined,
        property: meta.getAttribute('property') ?? undefined,
    }));
    const jsonLdBlocks = [...document.querySelectorAll('script[type="application/ld+json"]')].map(
        (script) => script.textContent ?? '',
    );
    return {
        html: document.documentElement.outerHTML,
        jsonLdBlocks,
        links,
        metas,
        // oxlint-disable-next-line unicorn/prefer-dom-node-text-content -- rendered text is the point; textContent would leak script bodies
        text: document.body?.innerText ?? '',
        title: document.title,
    };
}

// invariant: runs in the page before its first script, so it closes over nothing: the state it is handed is all it knows; a store a frame cannot reach (an opaque origin) is left as it is.
export function seedStorage(state: StorageState): void {
    if (state === 'throws') {
        for (const store of ['localStorage', 'sessionStorage']) {
            Object.defineProperty(globalThis, store, {
                configurable: true,
                get: () => {
                    throw new DOMException('The operation is insecure.', 'SecurityError');
                },
            });
        }
        return;
    }
    for (const [store, entries] of [
        ['localStorage', state.local],
        ['sessionStorage', state.session],
    ] as const) {
        for (const [key, value] of Object.entries(entries ?? {})) {
            try {
                // invariant: a key the page already holds is kept: the script runs again on each navigation, and a seed is the state a visit starts from, not one it returns to.
                if (globalThis[store].getItem(key) === null) {
                    globalThis[store].setItem(key, value);
                }
            } catch {
                // invariant: an origin that holds no storage keeps none.
            }
        }
    }
}
