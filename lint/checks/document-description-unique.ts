import { dirname, relative } from 'node:path';

import { readSpecFile } from '../../src/facets/cli/documents/spec-document.js';
import type { TokenViolation } from './checker.js';
import { listSpecFiles, readText } from './document-model.js';

export function checkSpecDescriptionsUnique(rootDir: string): TokenViolation[] {
    const byDirectory = new Map<string, Map<string, string>>();
    const violations: TokenViolation[] = [];
    for (const path of listSpecFiles(rootDir)) {
        let document;
        try {
            document = readSpecFile(readText(path), path).document;
        } catch {
            continue;
        }
        const dir = dirname(path);
        const seen = byDirectory.get(dir) ?? new Map<string, string>();
        byDirectory.set(dir, seen);
        const first = seen.get(document.description);
        const rel = relative(rootDir, path);
        if (first === undefined) {
            seen.set(document.description, rel);
            continue;
        }
        violations.push({
            file: rel,
            line: document.descriptionLine,
            fix: `retitle one of the two for what it proves apart from the other`,
            found: `"${document.description}", already the description of ${first}`,
            rule: 'document-description-unique',
            severity: 'error',
        });
    }
    return violations;
}
