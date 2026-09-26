import { basename, dirname, join, relative, resolve } from 'node:path';

import type { Severity } from '../../engine/checker/finding.js';
import { specsAnchor } from '../../engine/project/ast.js';
import { treeEntries } from '../../engine/project/git-tree.js';
import {
    documentPaths,
    parseSpecDocument,
    SPEC_EXTENSION,
} from '../../engine/project/spec-document.js';
import {
    collectFixtureReferences,
    DISK_CALL,
    findPools,
    GROUND_SUBDIRS,
    isConventionalSubdir,
    isReferrer,
    isWithin,
    listDirs,
    listReferrers,
    readSource,
    readText,
    specsRootOfPool,
} from '../../engine/project/tree.js';
import type { Finding } from './checker.js';

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
        // An all-hole template vouches for nothing; `no-unused-ground` already downgrades that file to warn through `hasNonLiteralFixtureArg`.
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

/** A non-literal path makes the reference set incomplete, so the feature is reported at warn: a false positive would be worse than a miss. */
const DISK_ARG = /(?<![.\w])(?:file|directory)\s*\(\s*(?<arg>[^,)]*)/gu;

const DISK_VERB_ARG = /\.(?:seed|request|fixture|run)\s*\(\s*(?<arg>[^,)]*)/gu;

const PLAIN_STRING = /^(?:'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`$\\]|\\.)*`)$/u;

function argumentsOf(text: string, pattern: RegExp): string[] {
    return [...text.matchAll(pattern)]
        .map((match) => (match.groups?.arg ?? '').trim())
        .filter((arg) => arg.length > 0);
}

function hasNonLiteralFixtureArg(text: string): boolean {
    const verbTakesABinding = argumentsOf(text, DISK_VERB_ARG).some(
        (arg) => !/^(?:file|directory)\s*\(/u.test(arg),
    );
    return verbTakesABinding || argumentsOf(text, DISK_ARG).some((arg) => !PLAIN_STRING.test(arg));
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

export function checkNoUnusedGround(rootDir: string): Finding[] {
    const violations: Finding[] = [];
    for (const dir of listDirs(rootDir)) {
        if (basename(dir) === 'specs') {
            continue;
        }
        let entries;
        try {
            entries = treeEntries(dir);
        } catch {
            continue;
        }
        const groundSubdirs = entries
            .filter(
                (entry) =>
                    entry.isDirectory() &&
                    GROUND_SUBDIRS.has(entry.name) &&
                    isConventionalSubdir(join(dir, entry.name)),
            )
            .map((entry) => entry.name);
        if (groundSubdirs.length === 0) {
            continue;
        }
        const feature = basename(dir);
        const testFiles = entries
            .filter((entry) => entry.isFile() && isReferrer(entry.name))
            .map((entry) => join(dir, entry.name));
        const rel = relative(rootDir, dir);

        // A domain owns 1..n `<aspect>.test.ts` (`specs-at-declared-depth`'): its ground is dead only when it carries no test at all.
        if (testFiles.length === 0) {
            violations.push({
                file: rel,
                line: 1,
                fix: `write the test that stands on ${groundSubdirs.join(', ')}, or delete the folder`,
                found: `a domain folder holding ${groundSubdirs.join(', ')} and no test or document`,
                rule: 'no-unused-ground',
                severity: 'error',
            });
            continue;
        }

        const references: References = { paths: new Set(), patterns: [] };
        let downgrade = false;
        for (const testFile of testFiles) {
            referencesOf(testFile, references);
            if (!testFile.endsWith(SPEC_EXTENSION)) {
                downgrade ||= hasNonLiteralFixtureArg(readSource(testFile));
            }
        }
        const severity: Severity = downgrade ? 'warn' : 'error';

        for (const sub of groundSubdirs) {
            const subPath = join(dir, sub);
            for (const entry of treeEntries(subPath)) {
                if (entryReferenced(join(subPath, entry.name), references)) {
                    continue;
                }
                const relEntry = relative(rootDir, join(subPath, entry.name));
                violations.push({
                    file: relEntry,
                    line: 1,
                    fix: `delete ${sub}/${entry.name}, or name it from the test that stands on it`,
                    found: `${sub}/${entry.name}, which no test of ${feature} names`,
                    rule: 'no-unused-ground',
                    severity,
                });
            }
        }
    }
    violations.push(...checkPoolFixtures(rootDir));
    return violations;
}

function checkPoolFixtures(rootDir: string): Finding[] {
    const violations: Finding[] = [];
    for (const pool of findPools(rootDir)) {
        const specsRoot = specsRootOfPool(pool);
        // A reference made from inside the pool is left out: a dead entry cannot vouch for another.
        const references: References = { paths: new Set(), patterns: [] };
        for (const file of listReferrers(specsRoot, pool)) {
            referencesOf(file, references);
        }
        for (const entry of treeEntries(pool)) {
            if (!entryReferenced(join(pool, entry.name), references)) {
                const relEntry = relative(rootDir, join(pool, entry.name));
                violations.push({
                    file: relEntry,
                    line: 1,
                    fix: `delete ${entry.name}, or name it from the specs that share it`,
                    found: `the pool entry ${entry.name}, which no spec under ${relative(rootDir, specsRoot) || basename(specsRoot)} names`,
                    rule: 'no-unused-ground',
                    severity: 'error',
                });
            }
        }
    }
    return violations;
}
