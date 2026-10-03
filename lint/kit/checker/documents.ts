import { writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import {
    documentMap,
    isBlock,
    keyName,
    listSpecFiles,
    pairsOf,
    runMaps,
    streamScalars,
} from '../project/document-model.js';
import { DOCUMENT_KEYS, readSpecFile, RUN_KEYS } from '../project/spec-document.js';
import type { SpecFile } from '../project/spec-document.js';
import { readText } from '../project/tree.js';
import { renderYamlSource, Scalar } from '../project/yaml-document.js';
import type { YAMLMap } from '../project/yaml-document.js';
import type { GroundPasses, Spotted } from './registry.js';

export function runDocument(
    text: string,
    rel: string,
    path: string,
    read: GroundPasses['read'],
): Spotted[] {
    let file: SpecFile;
    try {
        file = readSpecFile(text, rel);
    } catch {
        return [];
    }
    return read({ dir: dirname(path), file, rel }).map(({ fix, found, line, rule }) => ({
        fix,
        found,
        line,
        path: rel,
        rule,
    }));
}

function reorder(map: YAMLMap, order: readonly string[]): void {
    const known = pairsOf(map).filter((pair) => order.includes(keyName(pair) ?? ''));
    const sorted = [...known].toSorted(
        (a, b) => order.indexOf(keyName(a) ?? '') - order.indexOf(keyName(b) ?? ''),
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

export function unformattedSpecFiles(rootDir: string): string[] {
    return listSpecFiles(rootDir)
        .map((path) => relative(rootDir, path))
        .filter((rel) => fixSpecDocument(readText(join(rootDir, rel)), rel) !== null);
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
