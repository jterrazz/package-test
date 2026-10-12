import { afterEach, describe, expect, test } from 'vitest';

import { extractPage, seedStorage } from '../page-scripts.js';

const laid: string[] = [];

// invariant: a global the page would hold is laid for one test and removed after it, so no store outlives the test that made it.
function lay(name: string, value: unknown): void {
    Object.defineProperty(globalThis, name, { configurable: true, value });
    laid.push(name);
}

afterEach(() => {
    for (const name of laid.splice(0)) {
        Reflect.deleteProperty(globalThis, name);
    }
});

const seededWith = (state: Parameters<typeof seedStorage>[0]) => (): void => {
    seedStorage(state);
};

const storeOf = (initial: Record<string, string> = {}) => {
    const held = new Map(Object.entries(initial));

    return {
        getItem: (key: string): null | string => held.get(key) ?? null,
        held,
        setItem: (key: string, value: string): void => {
            held.set(key, value);
        },
    };
};

describe('page-scripts', () => {
    test('seedStorage — fills each store with the entries it is handed and keeps a key the page already holds', () => {
        // Given - a page whose local store holds one of the keys already, and an empty session store
        const local = storeOf({ theme: 'light' });
        const session = storeOf();
        lay('localStorage', local);
        lay('sessionStorage', session);

        // When - the seed runs
        seedStorage({ local: { theme: 'dark', zoom: '2' }, session: { draft: 'half a post' } });

        // Then - the key held stays, the others are laid
        expect([[...local.held], [...session.held]]).toStrictEqual([
            [
                ['theme', 'light'],
                ['zoom', '2'],
            ],
            [['draft', 'half a post']],
        ]);
    });

    test('seedStorage — a store that refuses is left as it is, and a seed with no store of one kind lays nothing there', () => {
        // Given - a local store that throws on every read, and a session store
        const session = storeOf();
        lay('localStorage', {
            getItem: () => {
                throw new Error('opaque origin');
            },
        });
        lay('sessionStorage', session);

        // When - the seed runs with a local entry and no session entry
        const seeded = seededWith({ local: { theme: 'dark' } });

        // Then - nothing is thrown, and the session store stays empty
        expect(seeded).not.toThrow();
        expect(session.held.size).toBe(0);
    });

    test('seedStorage — "throws" makes every read of both stores throw the browser’s own SecurityError', () => {
        // Given - the blocking seed, run once
        seedStorage('throws');

        // Then - each store throws a SecurityError when it is read
        const reads = ['localStorage', 'sessionStorage'].map((store) => {
            try {
                Reflect.get(globalThis, store);
                return 'read';
            } catch (error) {
                return error instanceof DOMException ? error.name : 'other';
            }
        });
        expect(reads).toStrictEqual(['SecurityError', 'SecurityError']);
    });

    test('extractPage — reads the links, metas, ld+json blocks, text and title off the document', () => {
        // Given - a document with one of each, links and metas with empty optional attributes
        lay('document', {
            body: { innerText: 'Hello' },
            documentElement: { outerHTML: '<html></html>' },
            querySelectorAll: (selector: string) => {
                if (selector === 'link') {
                    return [
                        {
                            href: 'https://x/a',
                            hreflang: 'fr',
                            rel: 'alternate',
                            type: 'text/html',
                        },
                        { href: 'https://x/b', hreflang: '', rel: 'icon', type: '' },
                    ];
                }
                if (selector === 'meta') {
                    return [
                        { content: 'c1', getAttribute: () => 'og:title', name: '' },
                        { content: 'c2', getAttribute: () => null, name: 'description' },
                    ];
                }
                return [{ textContent: '{"a":1}' }, { textContent: null }];
            },
            title: 'Page',
        });

        // Then - each field, empty attributes read as absent
        expect(extractPage()).toStrictEqual({
            html: '<html></html>',
            jsonLdBlocks: ['{"a":1}', ''],
            links: [
                { href: 'https://x/a', hreflang: 'fr', rel: 'alternate', type: 'text/html' },
                { href: 'https://x/b', hreflang: undefined, rel: 'icon', type: undefined },
            ],
            metas: [
                { content: 'c1', name: undefined, property: 'og:title' },
                { content: 'c2', name: 'description', property: undefined },
            ],
            text: 'Hello',
            title: 'Page',
        });
    });
});
