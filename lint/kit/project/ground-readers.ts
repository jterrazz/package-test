import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { documentPaths, parseSpecDocument } from './spec-document.js';
import { SPEC_EXTENSION } from './spec-grammar.js';
import { listFiles } from './tree.js';

// outside: vitest's `vi.mock`, `vi.doMock`, `vi.unmock`, `vi.doUnmock`, `vi.importActual` and `vi.importMock` name a module as `import()` does, and `new URL('...', import.meta.url)` a path beside the file.
export const RELATIVE_LITERAL =
    /(?<lead>(?<![.\w])(?:file|directory)\(\s*|\bfrom\s+|\bimport\(\s*|import\.meta\.dirname,\s*|(?<![.\w])vi\.(?:mock|doMock|unmock|doUnmock|importActual|importMock)\(\s*|\bnew\s+URL\(\s*(?=(?<base>['"])[^'"]*\k<base>\s*,\s*import\.meta\.url\b))(?<quote>['"])(?<path>\.\.?\/[^'"]*)\k<quote>/gu;

const FIXTURE_LINE = /^fixture:[ \t]*(?<quote>['"]?)(?<path>[^'"\s]+)\k<quote>[ \t]*(?:#.*)?$/gmu;

/** Each path a `.spec.yaml` document of the tree reads, by its `fixture:` lines, with the document reading it. */
export function documentReferences(specsRoot: string): { file: string; target: string }[] {
    return listFiles(specsRoot, (path) => path.endsWith(SPEC_EXTENSION)).flatMap((file) => {
        const text = readFileSync(file, 'utf8');
        try {
            return documentPaths(parseSpecDocument(text, file)).map(({ path }) => ({
                file,
                target: resolve(dirname(file), path),
            }));
        } catch {
            // invariant: a document the grammar refuses still reads its `fixture:` lines when it runs.
            return [...text.matchAll(FIXTURE_LINE)].map((found) => ({
                file,
                // Stryker disable next-line OptionalChaining: a match always carries its named groups
                target: resolve(dirname(file), String(found.groups?.path)),
            }));
        }
    });
}
