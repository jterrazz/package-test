import { finding, fixedData } from '../../kit/project/document-model.js';
import { assertedStreams } from '../../kit/project/spec-document.js';
import type { SpecDocument } from '../../kit/project/spec-document.js';
import type { DocumentFinding, Spotted } from './checker.js';

const VOLATILE = [
    {
        pattern: /\b(?:127\.0\.0\.1|localhost|0\.0\.0\.0):\d{2,5}\b/u,
        token: '{{url}} (or {{port}})',
    },
    { pattern: /(?:^|[\s"'(=])(?:\/private)?\/tmp\//u, token: '{{workdir}}' },
    { pattern: /(?:^|[\s"'(=])\/var\/folders\//u, token: '{{workdir}}' },
    { pattern: /(?:^|[\s"'(=])\/(?:Users|home)\/[^\s"'/]+\//u, token: '{{workdir}} or {{path}}' },
] as const;

/** A `{{token}}` is removed first: a path written after one is the token's tail, not a literal. */
/** A pattern matches the shape that makes a value volatile, so the carve-out looks up the whole word, or one pinned `/tmp/` would exempt every temp path. */
function wordAround(text: string, index: number): string {
    let start = index;
    let end = index;
    while (start > 0 && !/[\s"'(),;=]/u.test(text[start - 1] ?? '')) {
        start -= 1;
    }
    while (end < text.length && !/[\s"'(),;=]/u.test(text[end] ?? '')) {
        end += 1;
    }
    return text.slice(start, end);
}

export function volatileLiteralIn(
    line: string,
): undefined | { found: string; token: string; word: string } {
    const bare = line.replaceAll(/\{\{[^}]*\}\}/gu, ' ');
    for (const { pattern, token } of VOLATILE) {
        const found = pattern.exec(bare);
        if (found !== null) {
            const at = found.index + found[0].length - found[0].trimStart().length;
            return { found: found[0].trim(), token, word: wordAround(bare, at) };
        }
    }
    return undefined;
}

/** Unless the document fixed it, the carve-out `pinned-value-from-the-input` rests on: a value the document states rather than one the run minted. */
export function checkNoVolatileLiteral(document: SpecDocument, dir: string): DocumentFinding[] {
    const findings: DocumentFinding[] = [];
    let fixed: null | string = null;
    for (const stream of assertedStreams(document)) {
        for (const [index, text] of stream.text.split('\n').entries()) {
            const volatileLiteral = volatileLiteralIn(text);
            if (volatileLiteral === undefined) {
                continue;
            }
            fixed ??= fixedData(document, dir);
            if (fixed.includes(volatileLiteral.word)) {
                continue;
            }
            findings.push(
                finding('no-volatile-literal', stream.line + index, {
                    fix: `write ${volatileLiteral.token} where "${volatileLiteral.found}" stands`,
                    found: `"${volatileLiteral.found}", a value the next run will not reproduce`,
                }),
            );
        }
    }
    return findings;
}

export function noVolatileLiteralsInGround(file: string, text: string): Spotted[] {
    return text.split('\n').flatMap((line, index) => {
        const volatileLiteral = volatileLiteralIn(line);
        return volatileLiteral === undefined
            ? []
            : [
                  {
                      path: file,
                      line: index + 1,
                      fix: `write ${volatileLiteral.token} where "${volatileLiteral.found}" stands`,
                      found: `"${volatileLiteral.found}", a value the next run will not reproduce`,
                      rule: 'no-volatile-literal',
                  },
              ];
    });
}
