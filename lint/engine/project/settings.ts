// oxlint-disable-next-line import/no-empty-named-blocks, unicorn/require-module-specifiers -- the merge below names a module this file must also import: an augmentation alone does not bring its module into a program that imports nothing else of it (TS2664), and there is no name here to import
import type {} from '@jterrazz/typescript/config';

/** The `test` section of `jterrazz.config.ts`. */
export type TestSettings = {
    /** Api collections no English plural names (`data`, `people`), by route segment. */
    collections?: readonly string[];
    /** Routes the api takes on any method (`app.all('/mcp', …)`), by path. */
    methodless?: readonly string[];
    /** Test packages a production module legitimately runs, each with its reason; `no-test-code-in-production` honours them. */
    production?: { allow: Readonly<Record<string, string>> };
    /** Path to an OpenAPI document (JSON or YAML) declaring the routes, when the app carries no route table. */
    routes?: string;
};

declare module '@jterrazz/typescript/config' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- declaration merging is the one thing only an interface can do, and it is the point
    interface JterrazzConfig {
        /** What `@jterrazz/test` reads. */
        test?: TestSettings;
    }
}
