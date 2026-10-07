import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RETIRED_SPELLINGS = ['toMatchRows', 'runFile', '$FIXTURES/'];

const NEGATIVE_INPUTS = [
    'lint/kit/project/__tests__/spec-document.test.ts',
    'lint/self/corpus/__tests__/retired-spellings.test.ts',
    'lint/self/corpus/retired-spellings.ts',
];

const ROOTS = ['README.md', 'docs', 'lint', 'skills', 'specs', 'src'];

const TEXT = /\.(?:[cm]?[jt]sx?|md|ya?ml|json|http|txt|sql)$/u;

const SKIPPED = new Set(['decisions', 'node_modules']);

function textFilesUnder(root: string, relative: string): string[] {
    const path = resolve(root, relative);
    if (TEXT.test(relative)) {
        return [relative];
    }
    return readdirSync(path, { withFileTypes: true })
        .filter((entry) => !SKIPPED.has(entry.name))
        .flatMap((entry) =>
            entry.isDirectory() || TEXT.test(entry.name)
                ? textFilesUnder(root, `${relative}/${entry.name}`)
                : [],
        );
}

export function retiredSpellingsIn(root: string): string[] {
    const exempt = new Set(NEGATIVE_INPUTS);
    return ROOTS.flatMap((relative) => textFilesUnder(root, relative))
        .filter((file) => !exempt.has(file))
        .flatMap((file) =>
            readFileSync(resolve(root, file), 'utf8')
                .split('\n')
                .flatMap((line, index) =>
                    RETIRED_SPELLINGS.filter((spelling) => line.includes(spelling)).map(
                        (spelling) => `${file}:${String(index + 1)}: ${spelling}`,
                    ),
                ),
        );
}
