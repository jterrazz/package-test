import { isGroundFolder, SETUP_FOLDER, treeEntries } from '@jterrazz/typescript/rules';
import { basename, dirname, join, relative, resolve } from 'node:path';

import { specsAnchor } from '../../kit/project/ast.js';
import { collectFixtureReferences } from '../../kit/project/named-paths.js';
import { documentPaths, parseSpecDocument } from '../../kit/project/spec-document.js';
import { SPEC_EXTENSION } from '../../kit/project/spec-grammar.js';
import { isModuleName } from '../../kit/project/specs-modules.js';
import {
    DISK_CALL,
    findPools,
    isConventionalSubdir,
    isReferrer,
    isSharedFolder,
    isWithin,
    listDirs,
    listFiles,
    listReferrers,
    readSource,
    readText,
    specsRootOfPool,
} from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

/** Read through the runner's own parser, so the two channels cannot disagree; an unparseable file vouches for nothing (`document-follows-its-grammar` reports it). */
function collectSpecLiterals(path: string): Set<string> {
    try {
        const document = parseSpecDocument(readText(path), path);
        return new Set(documentPaths(document).map((named) => named.path));
    } catch {
        return new Set();
    }
}

/** Over-collection only ever hides a dead-fixture finding, so a greedy regex is safe. */
const STRING_LITERAL =
    /'(?<single>(?:[^'\\\n]|\\.)*)'|"(?<double>(?:[^"\\\n]|\\.)*)"|`(?<template>(?:[^`$\\]|\\.)*)`/gu;

function collectLiterals(text: string): Set<string> {
    const found = new Set<string>();
    for (const match of text.matchAll(STRING_LITERAL)) {
        const value = match.groups?.single ?? match.groups?.double ?? match.groups?.template;
        if (value !== undefined && value.length > 0) {
            found.add(value);
        }
    }
    return found;
}

/** The hole is unreadable but its static ends are not: an entry matching the prefix and suffix could be asked for by the table, which is all `no-unused-ground` needs. */
export type LiteralPattern = { directory: string; prefix: string; suffix: string };

const TEMPLATE_WITH_HOLE = /`(?<body>(?:[^`\\]|\\.)*\$\{(?:[^`\\]|\\.)*)`/gu;

function collectLiteralPatterns(text: string, from: string): LiteralPattern[] {
    const found: LiteralPattern[] = [];
    for (const match of text.matchAll(TEMPLATE_WITH_HOLE)) {
        const body = match.groups?.body ?? '';
        const opens = body.indexOf('${');
        const closes = body.lastIndexOf('}');
        if (opens === -1 || closes === -1 || closes < opens) {
            continue;
        }
        const before = body.slice(0, opens);
        const cut = before.lastIndexOf('/');
        const prefix = before.slice(cut + 1);
        const suffix = body.slice(closes + 1);
        if (prefix.length > 0 || suffix.length > 0) {
            const folders = before.slice(0, Math.max(cut, 0));
            found.push({
                directory: resolve(from, folders),
                prefix,
                suffix: suffix.split('/')[0] ?? '',
            });
        }
    }
    return found;
}

/** An entry is referenced by the path that reaches it, never by a literal that merely spells its name. */
type References = { paths: Set<string>; patterns: LiteralPattern[] };

/** A source's other literals are read word by word from the file and from the project root too: a path may be bound to a name first, or run by a process service (`node specs/_shared/_fixtures/app/server.mjs`). */
function referencesOf(file: string, into: References): void {
    const from = dirname(file);
    if (file.endsWith(SPEC_EXTENSION)) {
        for (const literal of collectSpecLiterals(file)) {
            into.paths.add(resolve(from, literal));
        }
        return;
    }
    for (const { path } of collectFixtureReferences(file, DISK_CALL)) {
        into.paths.add(resolve(from, path));
    }
    const anchor = specsAnchor(file);
    const bases = anchor === undefined ? [from] : [from, dirname(anchor.directory)];
    const text = readSource(file);
    for (const literal of collectLiterals(text)) {
        for (const word of literal.split(/\s+/u).filter((part) => part.length > 0)) {
            for (const base of bases) {
                into.paths.add(resolve(base, word));
            }
        }
    }
    into.patterns.push(...collectLiteralPatterns(text, from));
}

function entryReferenced(path: string, references: References): boolean {
    const name = basename(path);
    for (const pattern of references.patterns) {
        if (
            pattern.directory === dirname(path) &&
            name.startsWith(pattern.prefix) &&
            name.endsWith(pattern.suffix)
        ) {
            return true;
        }
    }
    for (const reached of references.paths) {
        if (reached === path || isWithin(path, reached)) {
            return true;
        }
    }
    return false;
}

function groundSubdirsOf(dir: string): string[] {
    const ignored =
        basename(dir) === 'specs' || basename(dir) === SETUP_FOLDER || isSharedFolder(dir);
    if (ignored) {
        return [];
    }
    try {
        return treeEntries(dir)
            .filter(
                (entry) =>
                    entry.isDirectory() &&
                    isGroundFolder(entry.name) &&
                    isConventionalSubdir(join(dir, entry.name)),
            )
            .map((entry) => entry.name);
    } catch {
        return [];
    }
}

function unreferencedEntries(
    rootDir: string,
    dir: string,
    groundSubdirs: readonly string[],
    testFiles: readonly string[],
): Spotted[] {
    const references: References = { paths: new Set(), patterns: [] };
    for (const reader of listFiles(dir, (path) => isModuleName(basename(path)))) {
        referencesOf(reader, references);
    }
    for (const testFile of testFiles) {
        referencesOf(testFile, references);
    }
    return groundSubdirs.flatMap((sub) => {
        const subPath = join(dir, sub);
        return treeEntries(subPath)
            .filter((entry) => !entryReferenced(join(subPath, entry.name), references))
            .map((entry) => ({
                path: relative(rootDir, join(subPath, entry.name)),
                line: 1,
                fix: `delete ${sub}/${entry.name}, or name it from the test that stands on it`,
                found: `${sub}/${entry.name}, which no test of ${basename(dir)} names`,
                rule: 'no-unused-ground',
            }));
    });
}

function checkDomain(rootDir: string, dir: string): Spotted[] {
    const groundSubdirs = groundSubdirsOf(dir);
    if (groundSubdirs.length === 0) {
        return [];
    }
    const testFiles = listFiles(dir, (path) => isReferrer(basename(path)));
    // invariant: a domain owns 1..n `<aspect>.test.ts` (`specs-at-declared-depth`'): its ground is dead only when it carries no test at all.
    if (testFiles.length === 0) {
        return [
            {
                path: relative(rootDir, dir),
                line: 1,
                fix: `write the test that stands on ${groundSubdirs.join(', ')}, or delete the folder`,
                found: `a domain folder holding ${groundSubdirs.join(', ')} and no test or document`,
                rule: 'no-unused-ground',
            },
        ];
    }
    return unreferencedEntries(rootDir, dir, groundSubdirs, testFiles);
}

export function checkNoUnusedGround(rootDir: string): Spotted[] {
    return [
        ...listDirs(rootDir).flatMap((dir) => checkDomain(rootDir, dir)),
        ...checkPoolFixtures(rootDir),
    ];
}

function checkPoolFixtures(rootDir: string): Spotted[] {
    const violations: Spotted[] = [];
    for (const pool of findPools(rootDir)) {
        const specsRoot = specsRootOfPool(pool);
        // invariant: a reference made from inside the pool is left out: a dead entry cannot vouch for another.
        const references: References = { paths: new Set(), patterns: [] };
        for (const file of listReferrers(specsRoot, pool)) {
            referencesOf(file, references);
        }
        for (const entry of treeEntries(pool)) {
            if (!entryReferenced(join(pool, entry.name), references)) {
                const relEntry = relative(rootDir, join(pool, entry.name));
                violations.push({
                    path: relEntry,
                    line: 1,
                    fix: `delete ${entry.name}, or name it from the specs that share it`,
                    found: `the pool entry ${entry.name}, which no spec under ${relative(rootDir, specsRoot) || basename(specsRoot)} names`,
                    rule: 'no-unused-ground',
                });
            }
        }
    }
    return violations;
}
