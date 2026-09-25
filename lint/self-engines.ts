/**
 * The one slice each third-party engine is imported from, by the specifier's
 * prefix: a path prefix, or one exact module. `world/services/peer.ts` loads
 * the optional peers by name for their owners, and carries none of its own.
 *
 * A self module, and the one statement of engine ownership: I11
 * (`checker-source-imports.ts`) holds every import to it, and the layer map
 * (`self-layers.ts`) grants each folder the engines it lists here.
 */
export const ENGINE_OWNERS: Readonly<Record<string, readonly string[]>> = {
    '@hono/node-server': ['src/facets/api/'],
    '@vitest/browser-playwright': ['src/facets/component/'],
    'better-sqlite3': ['src/world/services/sqlite/'],
    hono: ['src/facets/api/'],
    msw: ['src/world/stubs/network/'],
    'oxc-parser': ['lint/module-parser.ts'],
    pg: ['src/world/services/postgres/'],
    playwright: ['src/facets/website/'],
    react: ['src/facets/component/'],
    'react-dom': ['src/facets/component/'],
    redis: ['src/world/services/redis/'],
    testcontainers: ['src/world/services/containers/'],
    vite: ['src/facets/component/'],
    'vitest-browser-react': ['src/facets/component/'],
    'vitest-mock-extended': ['src/world/mocks/'],
    'vitest/browser': ['src/facets/component/'],
    webdriverio: ['src/facets/mobile/'],
    yaml: ['src/kernel/yaml/document.ts'],
};

/** The engines owned at or below `tree` (`src/world/services/`), for the layer map's folder of it. */
export function enginesOwnedIn(tree: string): string[] {
    return Object.entries(ENGINE_OWNERS)
        .filter(([, owners]) => owners.some((owner) => owner.startsWith(tree)))
        .map(([engine]) => engine);
}
