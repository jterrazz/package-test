import { join, resolve } from 'node:path';

import type { Teaching } from '../catalogue/lesson.js';
import type { Severity } from '../checker/finding.js';
import { treeEntries, treeKind, treeNames } from './git-tree.js';
import { GROUND_FIXTURES } from './ground.js';
import { isRelativePath } from './relative-path.js';
import { SPEC_EXTENSION } from './spec-document.js';
import type { SpecDocument, SpecFile } from './spec-document.js';
import { readText } from './tree.js';
import { isMap, isScalar, isSeq } from './yaml-document.js';
import type { Node, Pair, Scalar, YAMLMap } from './yaml-document.js';

export type DocumentFinding<PassId extends string = string> = Teaching & {
    line: number;
    rule: PassId;
    severity: Severity;
};

export function finding<PassId extends string>(
    rule: PassId,
    line: number,
    { fix, found }: Teaching,
    severity: Severity = 'error',
): DocumentFinding<PassId> {
    return { fix, found, line, rule, severity };
}

/** `fixtures/` holds inputs, never scenarios. */
const PRUNED = new Set<string>(['.git', 'dist', GROUND_FIXTURES, 'node_modules']);

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
                if (!PRUNED.has(entry.name)) {
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

export function pairsOf(map: YAMLMap): Pair<Node, Node>[] {
    return map.items as Pair<Node, Node>[];
}

export function keyName(pair: Pair<Node, Node>): null | string {
    return isScalar(pair.key) && typeof pair.key.value === 'string' ? pair.key.value : null;
}

export function runMaps(file: SpecFile): YAMLMap[] {
    const map = documentMap(file);
    const items = map?.get('runs', true);
    return isSeq(items) ? (items.items as Node[]).filter((item) => isMap(item)) : [];
}

export function streamScalars(run: YAMLMap): { key: string; scalar: Scalar }[] {
    const found: { key: string; scalar: Scalar }[] = [];
    for (const pair of pairsOf(run)) {
        const key = keyName(pair);
        if (key === null) {
            continue;
        }
        if (['stderr', 'stdin', 'stdout'].includes(key) && isScalar(pair.value)) {
            found.push({ key, scalar: pair.value });
            continue;
        }
        if (key !== 'files' || !isMap(pair.value)) {
            continue;
        }
        for (const entry of pairsOf(pair.value)) {
            if (!isMap(entry.value)) {
                continue;
            }
            for (const assertion of pairsOf(entry.value)) {
                if (keyName(assertion) === 'equals' && isScalar(assertion.value)) {
                    found.push({
                        key: `files.${keyName(entry) ?? '?'}.equals`,
                        scalar: assertion.value,
                    });
                }
            }
        }
    }
    return found;
}

export function isBlock(scalar: Scalar): boolean {
    return String(scalar.type ?? '').startsWith('BLOCK');
}

/** A sibling `fixtures/` is the document's material whether or not a `fixture:` line names the exact file. */
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
        if (isRelativePath(fixture.path)) {
            visit(resolve(dir, fixture.path));
        }
    }
    visit(join(dir, GROUND_FIXTURES));
    return parts.join('\n');
}
