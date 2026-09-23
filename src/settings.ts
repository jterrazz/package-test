// oxlint-disable-next-line import/no-empty-named-blocks, unicorn/require-module-specifiers -- the merge below names a module this file must also import: an augmentation alone does not bring its module into a program that imports nothing else of it (TS2664), and there is no name here to import
import type {} from '@jterrazz/typescript/config';

/**
 * The `test` section of `jterrazz.config.ts` — the one file a repository
 * states its settings for the @jterrazz toolchain family in, a section per
 * package. `@jterrazz/typescript` owns the file and its `JterrazzConfig`
 * interface; this package adds its section by merging into it, so
 * `defineConfig({ test: … })` is typed wherever `@jterrazz/test` is installed.
 *
 * The section holds nothing yet — every setting this package reads is still
 * an option of the call that uses it — so it accepts an empty object and
 * refuses a key nobody reads.
 */
export type TestSettings = Record<string, never>;

declare module '@jterrazz/typescript/config' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- declaration merging is the one thing only an interface can do, and it is the point
    interface JterrazzConfig {
        /** What `@jterrazz/test` reads. */
        test?: TestSettings;
    }
}
