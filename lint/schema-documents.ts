import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { parseSpecDocument, SPEC_EXTENSION } from '../src/facets/cli/documents/spec-document.js';
import { treeEntries } from '../src/kernel/files/git-tree.js';
import { parseYamlSource } from '../src/kernel/yaml/document.js';

/** Two readers of one format agree only if something runs both on the same files; the validator is the meta-test's, since this layer imports no package. */

const SKIPPED = new Set(['.git', 'dist', 'node_modules']);

export function isFixture(file: string): boolean {
    return file.split('/').includes('fixtures');
}

export type SchemaVerdict = {
    file: string;
    parser: null | string;
    schema: string[];
};

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

export function documentData(text: string): unknown {
    return parseYamlSource(text).document.toJS();
}

export function parserRefusal(text: string, file: string): null | string {
    try {
        parseSpecDocument(text, file);
        return null;
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

export function schemaVerdicts(
    root: string,
    validate: (data: unknown) => string[],
): SchemaVerdict[] {
    return specDocuments(root).map((file) => {
        const text = readFileSync(join(root, file), 'utf8');
        return { file, parser: parserRefusal(text, file), schema: validate(documentData(text)) };
    });
}
