import { basename } from 'node:path';

export const FACETS: ReadonlySet<string> = new Set([
    'api',
    'cli',
    'integration',
    'job',
    'lint',
    'mobile',
    'website',
]);

/** The source, not a substring: `../website.specification` carries no extension. */
const IMPORT_SOURCE = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"](?<source>[^'"]+)['"]/gu;

const CONSTRUCTS = /\bspecification\.[a-z]+\s*\(/u;

/** Constructing the runner in the file counts: a refusal spec proves the constructor that must fail to start, and has no specification module to import. */
export function reachesRunner(text: string): boolean {
    for (const match of text.matchAll(IMPORT_SOURCE)) {
        // Stryker disable next-line StringLiteral: an import match always carries its source
        const { source = '' } = match.groups ?? {};
        if (source === '@jterrazz/test' || source.startsWith('@jterrazz/test/')) {
            return true;
        }
        if (basename(source).includes('.specification')) {
            return true;
        }
    }
    return CONSTRUCTS.test(text);
}
