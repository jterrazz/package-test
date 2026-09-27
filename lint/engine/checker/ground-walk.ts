import {
    GROUND_EXPECTED,
    GROUND_REQUESTS,
    GROUND_SEEDS,
    treeEntries,
} from '@jterrazz/typescript/rules';
import { join, relative } from 'node:path';

import { PRUNED_WITH_FIXTURES } from '../project/facet-folders.js';
import { SPEC_EXTENSION } from '../project/spec-document.js';
import { decodeText } from '../project/tree.js';
import { runDocument } from './documents.js';
import type { GroundEntry, GroundPasses, Spotted } from './registry.js';

type Ground = typeof GROUND_EXPECTED | typeof GROUND_REQUESTS | typeof GROUND_SEEDS;

const GROUND_DIRS = new Set<string>([GROUND_EXPECTED, GROUND_REQUESTS, GROUND_SEEDS]);


function documentFindings(entry: GroundEntry, passes: GroundPasses): Spotted[] {
    const text = decodeText(entry.path);
    return [
        ...passes.document({ name: entry.name, rel: entry.rel, text }),
        ...(text === null ? [] : runDocument(text, entry.rel, entry.path, passes.read)),
    ];
}

function groundFindings(
    entry: GroundEntry,
    inside: Ground,
    atTop: boolean,
    passes: GroundPasses,
): Spotted[] {
    if (inside === GROUND_SEEDS) {
        return passes.seed(entry);
    }
    const text = decodeText(entry.path);
    if (text === null) {
        return [];
    }
    const file = { ...entry, atTop, text };
    return inside === GROUND_REQUESTS ? passes.request(file) : passes.expected(file);
}

function nextGround(name: string, inside: Ground | null): Ground | null {
    return GROUND_DIRS.has(name) ? (name as Ground) : inside;
}

export function walkGround(rootDir: string, passes: GroundPasses): Spotted[] {
    const findings: Spotted[] = [];
    const visit = (dir: string, inside: Ground | null): void => {
        let entries;
        try {
            entries = treeEntries(dir);
        } catch {
            return;
        }
        for (const entry of entries) {
            const path = join(dir, entry.name);
            const found = { name: entry.name, path, rel: relative(rootDir, path) };
            if (entry.isDirectory()) {
                if (!PRUNED_WITH_FIXTURES.has(entry.name)) {
                    visit(path, nextGround(entry.name, inside));
                }
            } else if (entry.name.endsWith(SPEC_EXTENSION)) {
                findings.push(...documentFindings(found, passes));
            } else if (inside !== null) {
                const atTop = dir.endsWith(`/${inside}`) || dir.endsWith(`\\${inside}`);
                findings.push(...groundFindings(found, inside, atTop, passes));
            }
        }
    };
    visit(rootDir, null);
    return findings;
}
