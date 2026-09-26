import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseSpecDocument } from '../../../src/facets/cli/documents/spec-document.js';
import { documentData, specDocuments } from '../../engine/project/spec-documents.js';

/** Two readers of one format agree only if something runs both on the same files; the validator is the meta-test's, since this layer imports no package. */

export type SchemaVerdict = {
    file: string;
    parser: null | string;
    schema: string[];
};

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
