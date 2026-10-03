/** The one statement of library ownership: the layer map (`architecture.ts`) holds every import to its owner, and grants each folder the libraries listed here. */
export const OWNERS_OF_LIBRARIES: Readonly<Record<string, readonly string[]>> = {
    '@hono/node-server': ['src/facets/api/'],
    '@vitest/browser-playwright': ['src/facets/component/'],
    'better-sqlite3': ['src/services/sqlite/'],
    hono: ['src/facets/api/'],
    msw: ['src/stubs/delivery/'],
    'oxc-parser': ['lint/kit/project/module-parser.ts'],
    oxlint: ['src/facets/lint/rule-tester.ts'],
    pg: ['src/services/postgres/'],
    playwright: ['src/facets/website/'],
    react: ['src/facets/component/'],
    'react-dom': ['src/facets/component/'],
    redis: ['src/services/redis/'],
    testcontainers: ['src/services/containers/'],
    vite: ['src/facets/component/'],
    'vitest-browser-react': ['src/facets/component/'],
    'vitest-mock-extended': ['src/mocks/'],
    'vitest/browser': ['src/facets/component/'],
    webdriverio: ['src/facets/mobile/'],
    yaml: ['lint/kit/project/yaml-document.ts'],
};

export function librariesOwnedIn(tree: string): string[] {
    return Object.entries(OWNERS_OF_LIBRARIES)
        .filter(([, owners]) => owners.some((owner) => owner.startsWith(tree)))
        .map(([library]) => library);
}
