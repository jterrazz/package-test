import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { parseSpecDocument, SPEC_EXTENSION } from '../src/model/literate/spec-document.js';
import { treeEntries } from '../src/seams/git/tree.js';
import { parseYamlSource } from '../src/seams/yaml/document.js';

/**
 * The published schema, run against the documents it describes.
 *
 * `schema/spec.schema.json` is what an editor validates a `<case>.spec.yaml`
 * with; the runner validates with its own parser. Two readers of one format
 * agree only if something runs both on the same files: this module walks
 * the documents and reads the parser's verdict; the validator is the meta-test's,
 * since the layer ships and imports no package.
 */

/** Directories no document of the repository lives in. */
const SKIPPED = new Set(['.git', 'dist', 'node_modules']);

/** Is this document an input a negative spec runs — under a `fixtures/` folder? */
export function isFixture(file: string): boolean {
    return file.split('/').includes('fixtures');
}

/** One document: where it sits, and what the parser and the schema said. */
export type SchemaVerdict = {
    /** Repository-relative path. */
    file: string;
    /** The parser's refusal, or `null` when it reads the document. */
    parser: null | string;
    /** The schema's errors, empty when the document validates. */
    schema: string[];
};

/** Every `*.spec.yaml` git does not ignore under `root`, repository-relative and sorted. */
export function specDocuments(root: string): string[] {
    const found: string[] = [];
    const visit = (dir: string): void => {
        for (const entry of treeEntries(dir)) {
            const path = join(dir, entry.name);
            if (entry.isDirectory() && !SKIPPED.has(entry.name)) {
                visit(path);
            } else if (entry.isFile() && entry.name.endsWith(SPEC_EXTENSION)) {
                found.push(relative(root, path));
            }
        }
    };
    visit(root);
    return found.toSorted();
}

/** A document's data, as a JSON Schema validator reads it. */
export function documentData(text: string): unknown {
    return parseYamlSource(text).document.toJS();
}

/** The parser's refusal of a document, or `null` when it reads it. */
export function parserRefusal(text: string, file: string): null | string {
    try {
        parseSpecDocument(text, file);
        return null;
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

/**
 * What the parser and `validate` — the schema, compiled by the caller — say of
 * every document under `root`.
 */
export function schemaVerdicts(
    root: string,
    validate: (data: unknown) => string[],
): SchemaVerdict[] {
    return specDocuments(root).map((file) => {
        const text = readFileSync(join(root, file), 'utf8');
        return { file, parser: parserRefusal(text, file), schema: validate(documentData(text)) };
    });
}
