/** The one statement of library ownership: `one-owner-per-library` holds every import to it, and the layer map grants each folder the libraries listed here. */
export const OWNERS_OF_LIBRARIES: Readonly<Record<string, readonly string[]>> = {
    '@hono/node-server': ['src/facets/api/'],
    '@vitest/browser-playwright': ['src/facets/component/'],
    'better-sqlite3': ['src/world/services/sqlite/'],
    hono: ['src/facets/api/'],
    msw: ['src/world/stubs/network/'],
    'oxc-parser': ['lint/engine/project/module-parser.ts'],
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
    yaml: ['lint/engine/project/yaml-document.ts'],
};

export function librariesOwnedIn(tree: string): string[] {
    return Object.entries(OWNERS_OF_LIBRARIES)
        .filter(([, owners]) => owners.some((owner) => owner.startsWith(tree)))
        .map(([library]) => library);
}
