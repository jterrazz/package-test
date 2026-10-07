import { isGroundFolder, SETUP_FOLDER, treeEntries } from '@jterrazz/typescript/rules';
import { basename, dirname, join, relative, resolve } from 'node:path';

import { isNode, stringValue, walk } from '../../kit/project/ast.js';
import { parseProgram } from '../../kit/project/module-parser.js';
import { documentPaths, parseSpecDocument } from '../../kit/project/spec-document.js';
import { SPEC_EXTENSION } from '../../kit/project/spec-grammar.js';
import { specsAnchor } from '../../kit/project/specs-anchor.js';
import { isModuleName } from '../../kit/project/specs-modules.js';
import {
    findPools,
    isConventionalSubdir,
    isReferrer,
    isWithin,
    listDirs,
    listFiles,
    listReaders,
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

/** Over-collection only ever hides a dead-fixture finding, so a greedy regex is safe as the fallback for a source the parser refuses. */
const STRING_LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`$\\]|\\.)*`/gu;

function scannedLiterals(text: string): Set<string> {
    return new Set([...text.matchAll(STRING_LITERAL)].map(([literal]) => literal.slice(1, -1)));
}

/** Read from the syntax tree: a scan of quotes can pair a quote inside a template's hole with one far below it, and lose every literal in between. */
function collectLiterals(file: string, text: string): Set<string> {
    const program = parseProgram(file, text);
    if (!isNode(program)) {
        return scannedLiterals(text);
    }
    const found = new Set<string>();
    walk(program, (node) => {
        const value = stringValue(node);
        if (value !== undefined) {
            found.add(value);
        }
    });
    return found;
}

/** The hole is unreadable but its static ends are not: an entry matching the prefix and suffix could be asked for by the table, which is all `no-unused-ground` needs. */
export type LiteralPattern = { directory: string; prefix: string; suffix: string };

const TEMPLATE_WITH_HOLE = /`(?:[^`\\]|\\.)*\$\{(?:[^`\\]|\\.)*`/gu;

function collectLiteralPatterns(text: string, from: string): LiteralPattern[] {
    return [...text.matchAll(TEMPLATE_WITH_HOLE)]
        .map(([template]) => {
            const body = template.slice(1, -1);
            const before = body.slice(0, body.indexOf('${'));
            const cut = before.lastIndexOf('/');
            const tail = body.slice(body.lastIndexOf('}') + 1);
            return {
                directory: resolve(from, before.slice(0, Math.max(cut, 0))),
                prefix: before.slice(cut + 1),
                suffix: tail.slice(0, tail.search(/\/|$/u)),
            };
        })
        .filter(({ prefix, suffix }) => prefix !== '' || suffix !== '');
}

/** An entry is referenced by the path that reaches it, never by a literal that merely spells its name. */
type References = { paths: Set<string>; patterns: LiteralPattern[] };

/** A source's literals are read word by word from the file and from the project root too: a path may be bound to a name first, or run by a process service (`node specs/__fixtures__/app/server.mjs`). */
function pathsNamedBy(file: string): string[] {
    const from = dirname(file);
    if (file.endsWith(SPEC_EXTENSION)) {
        return [...collectSpecLiterals(file)].map((literal) => resolve(from, literal));
    }
    const anchor = specsAnchor(file);
    // Stryker disable next-line ConditionalExpression: a reader always sits under a specs root
    const bases = anchor === undefined ? [from] : [from, dirname(anchor.directory)];
    return [...collectLiterals(file, readSource(file))].flatMap((literal) =>
        literal.split(/\s/u).flatMap((word) => bases.map((base) => resolve(base, word))),
    );
}

function referencesOf(files: readonly string[]): References {
    return {
        paths: new Set(files.flatMap((file) => pathsNamedBy(file))),
        patterns: files.flatMap((file) => collectLiteralPatterns(readSource(file), dirname(file))),
    };
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
    const ignored = basename(dir) === 'specs' || basename(dir) === SETUP_FOLDER;
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
    const references = referencesOf([
        ...listFiles(dir, (path) => isModuleName(basename(path))),
        ...testFiles,
    ]);
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
        // invariant: a reference made from inside the pool is left out, as the walk never enters ground: a dead entry cannot vouch for another.
        const references = referencesOf(listReaders(specsRoot));
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
