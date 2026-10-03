import {
    GROUND_FIXTURES,
    PRUNED,
    treeEntries,
    treeKind,
    treeNames,
} from '@jterrazz/typescript/rules';
import type { Teaching } from '@jterrazz/typescript/rules';
import { join, resolve } from 'node:path';

import { SPEC_EXTENSION } from './spec-grammar.js';
import type { SpecDocument, SpecFile } from './spec-grammar.js';
import { scalarString } from './spec-node.js';
import { readText } from './tree.js';
import { isMap, isScalar, isSeq, nodeItems, nodePairs } from './yaml-document.js';
import type { Scalar, YAMLMap } from './yaml-document.js';

export type DocumentFinding<PassId extends string = string> = Teaching & {
    line: number;
    rule: PassId;
};

export function finding<PassId extends string>(
    rule: PassId,
    line: number,
    { fix, found }: Teaching,
): DocumentFinding<PassId> {
    return { fix, found, line, rule };
}

/** `_fixtures/` holds inputs, never scenarios. */
const UNLISTED: ReadonlySet<string> = new Set([...PRUNED, GROUND_FIXTURES]);

export function listSpecFiles(dir: string): string[] {
    const out: string[] = [];
    const visit = (current: string): void => {
        let entries;
        try {
            entries = treeEntries(current);
        } catch {
            return;
        }
        for (const entry of entries) {
            const path = join(current, entry.name);
            if (entry.isDirectory()) {
                if (!UNLISTED.has(entry.name)) {
                    visit(path);
                }
            } else if (entry.name.endsWith(SPEC_EXTENSION)) {
                out.push(path);
            }
        }
    };
    visit(dir);
    return out;
}

export function documentMap(file: SpecFile): null | YAMLMap {
    const root = file.source.document.contents;
    return isMap(root) ? root : null;
}

/** readSpecFile refused a document whose runs are not a list of maps: these checks only narrow. */
// Stryker disable OptionalChaining,BooleanLiteral,ConditionalExpression,MethodExpression,ArrayDeclaration
export function runMaps(file: SpecFile): YAMLMap[] {
    const items = documentMap(file)?.get('runs', true);
    return isSeq(items) ? nodeItems(items).filter((item) => isMap(item)) : [];
}
// Stryker restore OptionalChaining,BooleanLiteral,ConditionalExpression,MethodExpression,ArrayDeclaration

type StreamScalar = { key: string; scalar: Scalar };

function fileEqualsScalars(files: YAMLMap): StreamScalar[] {
    return nodePairs(files).flatMap((entry) =>
        isMap(entry.value)
            ? nodePairs(entry.value)
                  .filter((assertion) => scalarString(assertion.key) === 'equals')
                  .flatMap((assertion) =>
                      isScalar(assertion.value)
                          ? [
                                {
                                    key: `files.${String(scalarString(entry.key))}.equals`,
                                    scalar: assertion.value,
                                },
                            ]
                          : [],
                  )
            : [],
    );
}

const STREAM_KEYS = new Set(['stderr', 'stdin', 'stdout']);

export function streamScalars(run: YAMLMap): StreamScalar[] {
    return nodePairs(run).flatMap((pair) => {
        const key = String(scalarString(pair.key));
        if (STREAM_KEYS.has(key) && isScalar(pair.value)) {
            return [{ key, scalar: pair.value }];
        }
        // invariant: of the keys a run may hold, files: alone holds a map.
        return isMap(pair.value) ? fileEqualsScalars(pair.value) : [];
    });
}

export function isBlock(scalar: Scalar): boolean {
    return (scalar.type ?? '').startsWith('BLOCK');
}

/** A sibling `_fixtures/` is the document's material whether or not a `fixture:` line names the exact file. */
export function fixedData(document: SpecDocument, dir: string): string {
    const parts = document.runs.flatMap((run) => [run.stdin ?? '', run.command]);
    for (const token of document.env) {
        parts.push(token.kind === 'pair' ? `${token.key}=${token.value}` : token.name);
    }
    for (const entry of document.serve) {
        parts.push(entry.name, ...Object.values(entry.env));
    }
    const visit = (path: string): void => {
        const kind = treeKind(path);
        if (kind === undefined) {
            return;
        }
        if (kind === 'file') {
            parts.push(readText(path));
            return;
        }
        for (const entry of treeNames(path)) {
            visit(join(path, entry));
        }
    };
    for (const fixture of document.fixtures) {
        visit(resolve(dir, fixture.path));
    }
    visit(join(dir, GROUND_FIXTURES));
    return parts.join('\n');
}
