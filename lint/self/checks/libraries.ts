/** The one statement of library ownership: the layer map (`architecture.ts`) holds every import to its owner, and grants each folder the libraries listed here. */
export const OWNERS_OF_LIBRARIES: Readonly<Record<string, readonly string[]>> = {
    '@hono/node-server': ['src/specifications/api/'],
    '@vitest/browser-playwright': ['src/specifications/component/'],
    'better-sqlite3': ['src/services/sqlite/'],
    hono: ['src/specifications/api/'],
    msw: ['src/stubs/delivery/'],
    'oxc-parser': ['lint/kit/project/module-parser.ts'],
    oxlint: ['src/specifications/lint/rule-tester.ts'],
    pg: ['src/services/postgres/'],
    playwright: ['src/specifications/website/'],
    react: ['src/specifications/component/'],
    'react-dom': ['src/specifications/component/'],
    redis: ['src/services/redis/'],
    testcontainers: ['src/services/containers/'],
    vite: ['src/specifications/component/'],
    'vitest-browser-react': ['src/specifications/component/'],
    'vitest-mock-extended': ['src/mocks/'],
    'vitest/browser': ['src/specifications/component/'],
    webdriverio: ['src/specifications/mobile/'],
    yaml: ['lint/kit/project/yaml-document.ts'],
};

export function librariesOwnedIn(tree: string): string[] {
    return Object.entries(OWNERS_OF_LIBRARIES)
        .filter(([, owners]) => owners.some((owner) => owner.startsWith(tree)))
        .map(([library]) => library);
}
