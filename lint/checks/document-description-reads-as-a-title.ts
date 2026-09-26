import type { SpecDocument } from '../../src/facets/cli/documents/spec-document.js';
import { finding } from './document-model.js';
import type { Finding } from './document-model.js';

const MAX_DESCRIPTION = 100;

const SYMBOL_WORD = /^[A-Z0-9_]+$/u;

export function checkDescription(document: SpecDocument): Finding[] {
    const findings: Finding[] = [];
    const text = document.description;
    const line = document.descriptionLine;
    const at = (found: string, fix: string): Finding =>
        finding('document-description-reads-as-a-title', line, { fix, found });
    if (text.includes('\n')) {
        findings.push(
            at('a `description:` of several lines', 'write the vitest title on one line'),
        );
        return findings;
    }
    if (text.length > MAX_DESCRIPTION) {
        findings.push(
            at(
                `a \`description:\` of ${text.length} characters`,
                `shorten it under ${MAX_DESCRIPTION} characters — a title, not a paragraph`,
            ),
        );
    }
    if (text.endsWith('.')) {
        findings.push(
            at(
                'a `description:` ending with a period',
                'drop the period — a title is a fragment, not a sentence',
            ),
        );
    }
    const first = text.split(/\s+/u)[0] ?? '';
    if (/^[A-Z]/u.test(text) && !SYMBOL_WORD.test(first)) {
        findings.push(
            at(
                'a `description:` starting with a capital',
                `start it lowercase: "${text.charAt(0).toLowerCase()}${text.slice(1)}"`,
            ),
        );
    }
    return findings;
}
