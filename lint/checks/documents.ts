import { writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';

import {
    DOCUMENT_KEYS,
    readSpecFile,
    RUN_KEYS,
} from '../../src/facets/cli/documents/spec-document.js';
import type { SpecFile } from '../../src/facets/cli/documents/spec-document.js';
import { isScalar, renderYamlSource, Scalar } from '../../src/kernel/yaml/document.js';
import type { Node, Pair, YAMLMap } from '../../src/kernel/yaml/document.js';
import type { TokenViolation } from './checker.js';
import { checkDescription } from './document-description-is-a-title.js';
import { checkRegisteredNames } from './document-env-and-serve-registered.js';
import { checkKeyOrder } from './document-keys-in-canonical-order.js';
import {
    documentMap,
    isBlock,
    keyName,
    listSpecFiles,
    pairsOf,
    readText,
    runMaps,
    streamScalars,
} from './document-model.js';
import { checkBlockScalars } from './document-streams-written-as-block-scalars.js';
import { checkFileName } from './file-suffix-matches-place.js';
import { checkEmptyAssertions } from './no-empty-expected-stream.js';
import { checkSilentRefusals } from './no-silent-refusal.js';
import { checkVolatileLiterals } from './no-volatile-literal.js';
import { checkPinnedValues } from './pinned-value-from-the-input.js';

/** A document the grammar refuses yields nothing here: `document-follows-its-grammar` already reported it. */
export function checkSpecConventions(text: string, rel: string, path: string): TokenViolation[] {
    let file: SpecFile;
    try {
        file = readSpecFile(text, rel);
    } catch {
        return [];
    }
    const lineAt = (node: Pair<Node, Node> | Scalar): number => {
        const range = 'range' in node && Array.isArray(node.range) ? node.range : undefined;
        const { key } = node as Pair<Node, Node>;
        const target = range ?? (isScalar(key) && Array.isArray(key.range) ? key.range : undefined);
        return target === undefined ? 1 : file.source.lineAt(target[0]);
    };
    const dir = dirname(path);
    const findings = [
        ...checkKeyOrder(file, (pair) => lineAt(pair.key as unknown as Scalar)),
        ...checkBlockScalars(file, (scalar) => lineAt(scalar)),
        ...checkFileName(rel),
        ...checkDescription(file.document),
        ...checkVolatileLiterals(file.document, dir),
        ...checkPinnedValues(file.document, dir),
        ...checkEmptyAssertions(file.document),
        ...checkSilentRefusals(file.document),
        ...checkRegisteredNames(file.document, dir),
    ];
    return findings.map(({ fix, found, line, rule, severity }) => ({
        file: rel,
        fix,
        found,
        line,
        rule,
        severity,
    }));
}

function reorder(map: YAMLMap, order: readonly string[]): void {
    const known = pairsOf(map).filter((pair) => order.includes(keyName(pair) ?? ''));
    const sorted = [...known].sort(
        (a, b) => order.indexOf(keyName(a)!) - order.indexOf(keyName(b)!),
    );
    let cursor = 0;
    map.items = pairsOf(map).map(
        (pair) => (order.includes(keyName(pair) ?? '') ? sorted[cursor++] : pair) ?? pair,
    );
}

/** `null` when nothing moved: the caller writes only what changed, so a clean tree keeps its mtimes. */
export function fixSpecDocument(text: string, rel: string): null | string {
    let file: SpecFile;
    try {
        file = readSpecFile(text, rel);
    } catch {
        return null;
    }
    const map = documentMap(file);
    if (map === null) {
        return null;
    }
    reorder(map, DOCUMENT_KEYS);
    for (const run of runMaps(file)) {
        reorder(run, RUN_KEYS);
        for (const { scalar } of streamScalars(run)) {
            if (!isBlock(scalar) && scalar.value !== '') {
                scalar.type = Scalar.BLOCK_LITERAL;
            }
        }
    }
    const next = renderYamlSource(file.source);
    return next === text ? null : next;
}

export function fixSpecFiles(rootDir: string): string[] {
    const written: string[] = [];
    for (const path of listSpecFiles(rootDir)) {
        const text = readText(path);
        const next = fixSpecDocument(text, relative(rootDir, path));
        if (next !== null) {
            writeFileSync(path, next);
            written.push(relative(rootDir, path));
        }
    }
    return written;
}
