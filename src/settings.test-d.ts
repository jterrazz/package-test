import { defineConfig } from '@jterrazz/typescript/config';

/**
 * The `test` section is a key of the family's settings wherever this package
 * is installed: the line below compiles only through the merge in
 * `settings.ts`, and `typescript check` fails the day it stops.
 */
export const withTestSection = defineConfig({ test: {} });

/** The route source is a path, read from the config's directory. */
export const withRouteSource = defineConfig({ test: { routes: './openapi.yaml' } });

// @ts-expect-error B12 — the `test` section reads what it declares, and nothing else [`'coverage' does not exist in type 'TestSettings'`]
export const withUnreadKey = defineConfig({ test: { coverage: 80 } });
