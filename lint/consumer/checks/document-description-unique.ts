import { dirname, relative } from 'node:path';

import { listSpecFiles } from '../../kit/project/document-model.js';
import { readSpecFile } from '../../kit/project/spec-document.js';
import { readText } from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

export function checkDocumentDescriptionUnique(rootDir: string): Spotted[] {
    const byDirectory = new Map<string, Map<string, string>>();
    const violations: Spotted[] = [];
    for (const path of listSpecFiles(rootDir)) {
        let document;
        try {
            ({ document } = readSpecFile(readText(path), path));
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
            path: rel,
            line: document.descriptionLine,
            fix: `retitle one of the two for what it proves apart from the other`,
            found: `"${document.description}", already the description of ${first}`,
            rule: 'document-description-unique',
        });
    }
    return violations;
}
