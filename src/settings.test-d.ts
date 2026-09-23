import { defineConfig } from '@jterrazz/typescript/config';

/**
 * The `test` section is a key of the family's settings wherever this package
 * is installed: the line below compiles only through the merge in
 * `settings.ts`, and `typescript check` fails the day it stops.
 */
export const withTestSection = defineConfig({ test: {} });
