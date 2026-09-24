// oxlint-disable-next-line import/no-empty-named-blocks, unicorn/require-module-specifiers -- the merge below names a module this file must also import: an augmentation alone does not bring its module into a program that imports nothing else of it (TS2664), and there is no name here to import
import type {} from '@jterrazz/typescript/config';

/**
 * The `test` section of `jterrazz.config.ts` — the one file a repository
 * states its settings for the @jterrazz toolchain family in, a section per
 * package. `@jterrazz/typescript` owns the file and its `JterrazzConfig`
 * interface; this package adds its section by merging into it, so
 * `defineConfig({ test: … })` is typed wherever `@jterrazz/test` is installed.
 * A key nobody reads does not compile.
 */
export type TestSettings = {
    /**
     * The api collections no English plural names — `data`, `people`, `media`
     * — by their route segment. The conventions checker files `GET /news`
     * under `news/list/` for them, where a singleton goes under `get/`.
     */
    collections?: readonly string[];
    /**
     * What a production module of this unit legitimately runs that F2 reads as
     * test material: under `allow`, a test package by name, with the reason
     * the product needs it — a service whose product IS a browser runs
     * `playwright`. F2 honours the list; nothing else is exempted.
     */
    production?: { allow: Readonly<Record<string, string>> };
    /**
     * The routes the member's api declares, when its app carries no table the
     * api facet reads (Hono's `app.routes`): a path, from the config's
     * directory, to an OpenAPI document (JSON or YAML). The api project's run
     * names every declared route no test reached.
     */
    routes?: string;
};

declare module '@jterrazz/typescript/config' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- declaration merging is the one thing only an interface can do, and it is the point
    interface JterrazzConfig {
        /** What `@jterrazz/test` reads. */
        test?: TestSettings;
    }
}
