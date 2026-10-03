import { quotedMask } from '@jterrazz/typescript/rules';
import { dirname, isAbsolute, resolve } from 'node:path';

import { isNode, nodeStart } from './ast.js';
import { parseProgram } from './module-parser.js';
import { literalPathVisitor, visitProgram } from './path-references.js';
import { isRelativePath } from './relative-path.js';
import { documentPaths, parseSpecDocument } from './spec-document.js';
import { SPEC_EXTENSION } from './spec-grammar.js';
import { columnAt, lineAt, readSource, readText } from './tree.js';

type FixtureReference = {
    column: number;
    file: string;
    key?: string;
    kind: 'directory' | 'file';
    line: number;
    path: string;
};

const FIXTURE_CALL =
    /\.fixture\(\s*(?<kind>file|directory)\(\s*(?<quote>['"`])(?<path>(?:[^'"`\\]|\\.)*)\k<quote>/gu;

function documentReferences(file: string): FixtureReference[] {
    try {
        return documentPaths(parseSpecDocument(readText(file), file)).map(
            ({ key, kind, line, path }) => ({ column: 1, file, key, kind, line, path }),
        );
    } catch {
        return [];
    }
}

function isNamedPath(path: string | undefined): path is string {
    return path !== undefined && path.length > 0 && isRelativePath(path) && !path.includes('${');
}

export function collectFixtureReferences(
    file: string,
    pattern = FIXTURE_CALL,
    codeOnly = false,
): FixtureReference[] {
    if (file.endsWith(SPEC_EXTENSION)) {
        return documentReferences(file);
    }
    const text = readSource(file);
    const quoted = codeOnly ? quotedMask(text) : [];
    return [...text.matchAll(pattern)].flatMap((match) => {
        const path = match.groups?.path;
        if (quoted[match.index] === true || !isNamedPath(path)) {
            return [];
        }
        const at = match.index + match[0].lastIndexOf(`${match.groups?.quote ?? ''}${path}`);
        const kind: FixtureReference['kind'] =
            match.groups?.kind === 'directory' ? 'directory' : 'file';
        return [{ column: columnAt(text, at), file, kind, line: lineAt(text, at), path }];
    });
}

/** A lone piece counts only when spelled `./` or `../`: a bare one (`resolve(import.meta.dirname, '../_expected')`) is as often an output folder as a path read; a piece opening on `/` restarts the path. */
export function anchoredPaths(
    file: string,
): { column: number; line: number; named: string; target: string }[] {
    const text = readText(file);
    const program = parseProgram(file, text);
    if (!isNode(program)) {
        return [];
    }
    const found: { column: number; line: number; named: string; target: string }[] = [];
    visitProgram(
        program,
        literalPathVisitor(({ node, pieces }) => {
            const [only] = pieces;
            const lone = pieces.length === 1 && !isRelativePath(only ?? '');
            if (lone || pieces.some((piece) => isAbsolute(piece))) {
                return;
            }
            const at = nodeStart(node);
            found.push({
                column: columnAt(text, at),
                line: lineAt(text, at),
                named: pieces.map((piece) => `'${piece}'`).join(', '),
                target: resolve(dirname(file), ...pieces),
            });
        }),
    );
    return found;
}
