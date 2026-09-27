import { dirname, relative } from 'node:path';

import { listSpecFiles } from '../../engine/project/document-model.js';
import { readSpecFile } from '../../engine/project/spec-document.js';
import { readText } from '../../engine/project/tree.js';
import type { Finding } from './checker.js';

export function checkDocumentDescriptionUnique(rootDir: string): Finding[] {
    const byDirectory = new Map<string, Map<string, string>>();
    const violations: Finding[] = [];
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
        });
    }
    return violations;
}
