import { readFileSync } from 'node:fs';
import { basename, isAbsolute, resolve } from 'node:path';

import { readSpecFile, SpecSyntaxError } from '../../../../lint/kit/project/spec-document.js';
import type { SpecFile } from '../../../../lint/kit/project/spec-document.js';
import { refusal } from '../../../chain/refusals/refusal.js';
import { DISK_KEY } from '../../../disk/spec-path.js';

/** Makes a `<case>.spec.yaml` a test file: the runner shows the document's path and its `description:`. */

const SPEC_FILE = /\.spec\.yaml(?:\?.*)?$/u;

export type LiterateOptions = {
    /** Globs added to the test include; narrow it when a tree holds documents that are inputs to other specs. */
    include?: string[];
    /** Path to the `*.specification.ts` whose export named for each document's `kind:` runs it; stated, never guessed. */
    specification: string;
};

/** Structural, so the runner coupling stays one dependency (the layer map); assignable to vite's `Plugin`. */
export type LiteratePlugin = {
    config: () => { test: { include: string[] } };
    /** Vite hands the resolved root here — what a relative `specification` is resolved against. */
    configResolved: (resolved: { root: string }) => void;
    enforce: 'pre';
    load: (id: string) => null | string;
    name: string;
};

export function grammarRefusal(error: SpecSyntaxError, displayPath: string): Error {
    return new Error(
        refusal({
            fix: 'write the key the grammar names; the reason prints the accepted set',
            found: `${displayPath}:${error.line}: ${error.reason}`,
            read: 'docs/24-linting.md#document-follows-its-grammar',
            why: 'A spec document follows one grammar, read by the parser the runner and the linter share: closed keys, `description:` and `runs:` required, `command:` and `exit:` in every run.',
        }),
        { cause: error },
    );
}

function readDocument(content: string, displayPath: string): SpecFile {
    try {
        return readSpecFile(content, displayPath);
    } catch (error) {
        throw error instanceof SpecSyntaxError ? grammarRefusal(error, displayPath) : error;
    }
}

/** The document is handed to `cli.run()` spelled by its brand, so the module imports the runner alone. */
export function literateModule(
    content: string,
    filePath: string,
    specificationPath: string,
): string {
    const { description } = readDocument(content, filePath).document;
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
            ({ root } = resolved);
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
