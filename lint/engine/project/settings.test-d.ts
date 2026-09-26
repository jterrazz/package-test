import { defineConfig } from '@jterrazz/typescript/config';

/** Compiles only through the module merge in `settings.ts`. */
export const withTestSection = defineConfig({ test: {} });

export const withRouteSource = defineConfig({ test: { routes: './openapi.yaml' } });

export const withCollections = defineConfig({ test: { collections: ['data', 'people'] } });

export const withMethodless = defineConfig({ test: { methodless: ['/mcp'] } });

// @ts-expect-error the collections are a list, never one word [`Type 'string' is not assignable to type 'readonly string[]'`]
export const withOneCollection = defineConfig({ test: { collections: 'data' } });

// @ts-expect-error the `test` section reads what it declares, and nothing else [`'coverage' does not exist in type 'TestSettings'`]
export const withUnreadKey = defineConfig({ test: { coverage: 80 } });
