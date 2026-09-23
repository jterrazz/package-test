import { readFileSync } from 'node:fs';
import { basename, isAbsolute, resolve } from 'node:path';

import { DISK_KEY } from '../model/chain/spec-path.js';
import { readSpecFile } from '../model/literate/spec-document.js';

/**
 * The `literate()` vite plugin — door one of the spec-document format.
 *
 * It makes a `<case>.spec.yaml` file a TEST FILE: the glob joins the project's
 * test include, and each document is transformed into a one-test module that
 * runs the file through the runner its `kind:` names. The runner shows the
 * document's path as the file and its `description:` as the title, so a failing
 * scenario is opened where it is written — not in a `.test.ts` that merely
 * points at it.
 *
 * ```typescript
 * // vitest.config.ts
 * import { defineConfig } from 'vitest/config';
 * import { literate } from '@jterrazz/test/vitest';
 *
 * export default defineConfig({
 *     plugins: [literate({ specification: './specs/cli/cli.specification.ts' })],
 * });
 * ```
 */

/** The `.spec.yaml` extension, matched on the id vite hands the plugin. */
const SPEC_FILE = /\.spec\.yaml(?:\?.*)?$/u;

export type LiterateOptions = {
    /**
     * Globs added to the project's test include. Default: every `.spec.yaml`
     * file. Narrow it when a tree holds documents that are INPUTS to other
     * specs (a deliberately-wrong golden) rather than scenarios to run.
     */
    include?: string[];
    /**
     * Path to the `*.specification.ts` whose export named for each document's
     * `kind:` — `cli`, `api` or `jobs` — runs the files, relative to the vite
     * root, or absolute.
     *
     * It is stated, never guessed: a repository may declare several cli
     * runners (different binaries, different service records), and there is no
     * convention that could pick the right one without silently binding a
     * scenario to the wrong command.
     */
    specification: string;
};

/**
 * The shape vite consumes. Declared structurally rather than imported from
 * `vite`, so the package's runner coupling stays the one dependency it already
 * has (CONVENTIONS I1) — the object is assignable to vite's `Plugin`.
 */
export type LiteratePlugin = {
    config: () => { test: { include: string[] } };
    /** Vite hands the resolved root here — what a relative `specification` is resolved against. */
    configResolved: (resolved: { root: string }) => void;
    enforce: 'pre';
    load: (id: string) => null | string;
    name: string;
};

/**
 * The module a `<case>.spec.yaml` becomes: one `test()` whose title is the
 * document's `description:` and whose body runs the whole file through the
 * runner its `kind:` names — `cli`, `api` or `jobs`, the export the bound
 * specification hands out under that name.
 *
 * The document is handed to `<kind>.run()` as the value
 * `file('./<case>.spec.yaml')` returns, spelled by its brand: the generated
 * module imports the runner and nothing else, so it resolves the same way from
 * a consumer's install and from this repository's source.
 *
 * @internal Exported for unit tests.
 */
export function literateModule(
    content: string,
    filePath: string,
    specificationPath: string,
): string {
    const { description, kind } = readSpecFile(content, filePath).document;
    return [
        "import { test } from 'vitest';",
        `import { ${kind} } from ${JSON.stringify(specificationPath)};`,
        '',
        `test(${JSON.stringify(description)}, async () => {`,
        `    await ${kind}.run({ [Symbol.for(${JSON.stringify(DISK_KEY)})]: 'file', path: ${JSON.stringify(`./${basename(filePath)}`)} });`,
        '});',
        '',
    ].join('\n');
}

/** Strip vite's query suffix (`?v=…`) from a module id. */
function cleanId(id: string): string {
    return id.split('?')[0] ?? id;
}

export function literate(options: LiterateOptions): LiteratePlugin {
    const include = options.include ?? ['**/*.spec.yaml'];
    let root = process.cwd();

    return {
        config: () => ({ test: { include } }),
        configResolved: (resolved) => {
            root = resolved.root;
        },
        enforce: 'pre',
        load: (id) => {
            if (!SPEC_FILE.test(id)) {
                return null;
            }
            const filePath = cleanId(id);
            const specificationPath = isAbsolute(options.specification)
                ? options.specification
                : resolve(root, options.specification);
            return literateModule(readFileSync(filePath, 'utf8'), filePath, specificationPath);
        },
        name: 'jterrazz-test:literate',
    };
}
