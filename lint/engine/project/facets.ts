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
        const source = match.groups?.source ?? '';
        if (source === '@jterrazz/test' || source.startsWith('@jterrazz/test/')) {
            return true;
        }
        if (source.slice(source.lastIndexOf('/') + 1).includes('.specification')) {
            return true;
        }
    }
    return CONSTRUCTS.test(text);
}
