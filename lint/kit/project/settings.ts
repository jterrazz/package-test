// oxlint-disable-next-line import/no-empty-named-blocks, unicorn/require-module-specifiers -- the merge below names a module this file must also import: an augmentation alone does not bring its module into a program that imports nothing else of it (TS2664), and there is no name here to import
import type {} from '@jterrazz/typescript/config';

/** The `test` section of `jterrazz.config.ts`. */
export type TestSettings = {
    /** Api collections no English plural names (`data`, `people`), by route segment. */
    collections?: readonly string[];
    /** Routes the api takes on any method (`app.all('/mcp', …)`), by path. */
    methodless?: readonly string[];
    production?: { allow: Readonly<Record<string, string>> };
    /** Path to an OpenAPI document (JSON or YAML) declaring the routes, when the app carries no route table. */
    /** The vitest projects the derived `vitest.config.ts` runs, each a facet and that facet's options; none, the preset's one root project. */
    projects?: readonly TestProject[];
    routes?: string;
};

/** The helpers a project is built by, named by their facet. */
export type TestFacet =
    | 'api'
    | 'cli'
    | 'component'
    | 'integration'
    | 'job'
    | 'lint'
    | 'mobile'
    | 'unit'
    | 'website';

/** A project of the derived config: its facet, the global setups it runs, and the options its helper takes. */
export type TestProject = {
    readonly facet: TestFacet;
    readonly setup?: readonly string[];
    readonly [option: string]: unknown;
};

declare module '@jterrazz/typescript/config' {
    interface JterrazzConfig {
        /** What `@jterrazz/test` reads. */
        test?: TestSettings;
    }
}
