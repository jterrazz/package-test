import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

import { specDescription } from '../core/specification/cli/literate.js';

/**
 * The `literate()` vite plugin — door one of the spec-document format.
 *
 * It makes a `<case>.spec.yaml` file a TEST FILE: the glob joins the project's
 * test include, and each document is transformed into a one-test module that
 * runs the file through the registered `cli` runner. The runner shows the
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
const SPEC_FILE = /\.spec\.yaml(?:\?.*)?$/;

export interface LiterateOptions {
    /**
     * Globs added to the project's test include. Default: every `.spec.yaml`
     * file. Narrow it when a tree holds documents that are INPUTS to other
     * specs (a deliberately-wrong golden) rather than scenarios to run.
     */
    include?: string[];
    /**
     * Path to the `*.specification.ts` whose exported `cli` runs the files —
     * relative to the vite root, or absolute.
     *
     * It is stated, never guessed: a repository may declare several cli
     * runners (different binaries, different service records), and there is no
     * convention that could pick the right one without silently binding a
     * scenario to the wrong command.
     */
    specification: string;
}

/**
 * The shape vite consumes. Declared structurally rather than imported from
 * `vite`, so the package's runner coupling stays the one dependency it already
 * has (CONVENTIONS I1) — the object is assignable to vite's `Plugin`.
 */
export interface LiteratePlugin {
    config: () => { test: { include: string[] } };
    /** Vite hands the resolved root here — what a relative `specification` is resolved against. */
    configResolved: (resolved: { root: string }) => void;
    enforce: 'pre';
    load: (id: string) => null | string;
    name: string;
}

/**
 * The module a `<case>.spec.yaml` becomes: one `test()` whose title is the
 * document's `description:` and whose body runs the whole file — its ground,
 * its servers, every run asserted.
 *
 * @internal Exported for unit tests.
 */
export function literateModule(
    content: string,
    filePath: string,
    specificationPath: string,
): string {
    const title = specDescription(content, filePath);
    return [
        "import { test } from 'vitest';",
        `import { cli } from ${JSON.stringify(specificationPath)};`,
        '',
        `test(${JSON.stringify(title)}, async () => {`,
        `    await cli.run(${JSON.stringify(filePath)});`,
        '});',
        '',
    ].join('\n');
}

/** Strip vite's query suffix (`?v=…`) from a module id. */
function cleanId(id: string): string {
    return id.split('?')[0];
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
