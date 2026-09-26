import { readFileSync } from 'node:fs';
import { basename, isAbsolute, resolve } from 'node:path';

import { readSpecFile } from '../../../../lint/engine/project/spec-document.js';
import { DISK_KEY } from '../../../kernel/files/spec-path.js';

/** Makes a `<case>.spec.yaml` a test file: the runner shows the document's path and its `description:`. */

const SPEC_FILE = /\.spec\.yaml(?:\?.*)?$/u;

export type LiterateOptions = {
    /** Globs added to the test include; narrow it when a tree holds documents that are inputs to other specs. */
    include?: string[];
    /** Path to the `*.specification.ts` whose export named for each document's `kind:` runs it; stated, never guessed. */
    specification: string;
};

/** Structural, so the runner coupling stays one dependency (`import-within-declared-layers`); assignable to vite's `Plugin`. */
export type LiteratePlugin = {
    config: () => { test: { include: string[] } };
    /** Vite hands the resolved root here — what a relative `specification` is resolved against. */
    configResolved: (resolved: { root: string }) => void;
    enforce: 'pre';
    load: (id: string) => null | string;
    name: string;
};

/** The document is handed to `cli.run()` spelled by its brand, so the module imports the runner alone. */
export function literateModule(
    content: string,
    filePath: string,
    specificationPath: string,
): string {
    const { description } = readSpecFile(content, filePath).document;
    return [
        "import { test } from 'vitest';",
        `import { cli } from ${JSON.stringify(specificationPath)};`,
        '',
        `test(${JSON.stringify(description)}, async () => {`,
        `    await cli.run({ [Symbol.for(${JSON.stringify(DISK_KEY)})]: 'file', path: ${JSON.stringify(`./${basename(filePath)}`)} });`,
        '});',
        '',
    ].join('\n');
}

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
