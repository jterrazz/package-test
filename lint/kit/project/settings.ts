// oxlint-disable-next-line import/no-empty-named-blocks, unicorn/require-module-specifiers -- the merge below names a module this file must also import: an augmentation alone does not bring its module into a program that imports nothing else of it (TS2664), and there is no name here to import
import type {} from '@jterrazz/typescript/config';

/** The `test` section of `jterrazz.config.ts`. */
export type TestSettings = {
    /** The path every api route is mounted under (`'/api'`), left out of the folder each route's subject derives. */
    basePath?: `/${string}`;
    /** Api collections no English plural names (`data`, `people`), by route segment. */
    collections?: readonly string[];
    /** Routes the api takes on any method (`app.all('/mcp', …)`), each path mapped to why it takes any. */
    methodless?: Readonly<Record<string, string>>;
    production?: { allow: Readonly<Record<string, string>> };
    /** How a project departs from the one its tree derives, keyed by its specification, with the reason. */
    projects?: Readonly<Partial<Record<TestSpecification, TestProject>>>;
    /** Path to an OpenAPI document (JSON or YAML) declaring the routes, when the app carries no route table. */
    routes?: string;
    /** The folders of `specs/` that hold specifications, each filing its specs under the subject they prove: `specs/<specification>/<subject>/`. */
    specifications?: readonly string[];
};

/** The helpers a project is built by, named by their specification. */
export type TestSpecification =
    | 'api'
    | 'cli'
    | 'component'
    | 'integration'
    | 'job'
    | 'lint'
    | 'mobile'
    | 'unit'
    | 'website';

/** What a declared project states beyond its derived one: the global setups it runs, the options its helper takes, and why. */
export type TestProject = {
    readonly reason: string;
    readonly setup?: readonly string[];
    readonly [option: string]: unknown;
};

declare module '@jterrazz/typescript/config' {
    interface JterrazzConfig {
        /** What `@jterrazz/test` reads. */
        test?: TestSettings;
    }
}
