#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { moveKeepingHistory } from '../src/kernel/files/git-tree.js';
import { fixCopiedGround, fixRootGround } from './checker-crossfile.js';
import { checkMember, checkMembers, discoverMembers, discoverSpecRoots } from './checker-member.js';
import { migrateLintConfig, migrateModuleTestsTo17, migrateTo17 } from './checker-migration.js';
import type { LintConfigMove, Migration } from './checker-migration.js';
import { movesUnderFacet } from './checker-placement.js';
import { fixGroundSharing } from './checker-sharing.js';
import { fixSpecFiles } from './checker-spec.js';
import { fixSubjects } from './checker-subject.js';
import {
    CHECKER_PASS_IDS,
    formatViolation,
    MEMBER_PASS_IDS,
    messageOf,
    runAllChecks,
    TREE_PASS_IDS,
} from './checker.js';
import type { TokenViolation } from './checker.js';
import { tightened } from './ratchet-fix.js';
import { applyOwnFixes } from './ratchet-own-fixes.js';
import {
    BASELINE_FILE,
    BASELINE_LABEL,
    CHECKER_NAMESPACE,
    countsOf,
    judge,
    keepsBaseline,
    pluginDiagnostics,
    readBaseline,
    writeBaseline,
} from './ratchet.js';
import type { PluginDiagnostic } from './ratchet.js';
import { packageRootOf, projectRootOf } from './role.js';
import { codeOf } from './rule-code.js';

/* oxlint-disable eslint/no-console -- this file IS the CLI: its output is the product, and a reporter that wrote anywhere else would be reporting to nobody. */
/**
 * CLI entry for the conventions checker (bundled as `dist/checker.js`).
 *
 *     node dist/checker.js [dir] [--fix]              # a specs tree, or a project root
 *     node dist/checker.js --format json              # every root, every member
 *     node dist/checker.js --member <dir>             # one workspace member
 *     node dist/checker.js baseline [root]            # record jterrazz.baseline.json › test
 *     node dist/checker.js … --oxlint-report <file>   # read the plugin's diagnostics from a report
 *     node dist/checker.js … --verbose                # a green ratchet run also names where it stood and what ran
 *
 * Three runs, one reporter. A PATH is read for what it IS. Name a specs tree
 * — a directory with a `specs` segment below its package root — and it walks that tree
 * with every tree pass: the token/HTTP grammar (D4 / D4b / D10), the
 * `<case>.spec.yaml` document conventions, the cross-file passes (C9 dead
 * fixtures, C14/C15 fixture placement, B5 await-using inference, A7 database
 * property) and the facet passes (C12, C18, C20, C21w), which read the first
 * level of the tree and are the reason the anchor has to be right. Name
 * anything else and it is a PROJECT ROOT: the run is the path-less one,
 * anchored there. With `--member <dir>` it runs the member pass (E3
 * config-present, E5b no simulated DOM in a config, F8 no seam dependency)
 * over one workspace member, whether or not that member has a `specs/` root.
 *
 * With NO path it runs both over the whole project: every `specs/` root it
 * discovers from the root manifest's workspaces, and every member. That is the
 * run the ratchet rests on, so the contract is exactly "a path-less run
 * reports what the per-root and per-member runs report".
 *
 * A NAMED root that turns out to hold no `specs/` tree at all is refused, loud
 * and non-zero. Pointed at a project root, the facet passes used to key on its
 * first level, find no facet folder there and report nothing — `<project>` and
 * `<project>/specs` disagreed on the same tree, and the run that reported
 * nothing was the one a CI line was likelier to be written with.
 *
 * `--format json` prints `[{ code, file, line, severity, message }]` on stdout
 * and nothing else, where `code` is `jterrazz-check(<id>)` — the namespace the
 * ratchet records under.
 *
 * The verdict is the RATCHET's (`ratchet.ts`), and one run owns it: the run
 * over the whole project — path-less, a named project root, or `--member` on
 * the project root itself, the run `typescript check` always makes. It counts
 * every checker finding of the project and every diagnostic of this package's
 * oxlint plugin (the toolchain sets those aside, so they are judged here or
 * nowhere) against the `test` section of `jterrazz.baseline.json` at the root:
 * at it, exit 0; grown, new, fallen, or an entry at zero, exit 1. The retired
 * `test.baseline.json` is never read: `typescript check` owns the refusal of a
 * leftover per-package file. A project that keeps no section fails on
 * any ERROR finding and on any plugin diagnostic. Every other run under a
 * project that keeps a baseline reports what it found and leaves the verdict
 * to that one run; without a baseline it fails on an ERROR finding, as ever.
 * A green verdict is exactly one line — `jterrazz.baseline.json › test: <n>
 * held across <k> rules`, whether the run checked, fixed or judged the root
 * member — the line `typescript check` shows beside its own ratchet's; a
 * project whose section is absent or holds nothing prints `jterrazz.baseline.json
 * › test: nothing held`, and a run that defers names the judging file relative to the project. A
 * failing one prints every finding it counted before its reasons, so a verdict
 * and its evidence are one log — and the plugin's diagnostics as one count
 * when they come from `--oxlint-report`, whose pass prints each of them, or
 * each in full when the checker ran oxlint itself and is their one printer. `--verbose`
 * adds to the green line where the run stood and every pass that ran.
 * `baseline [root]` writes the `test` section from the current counts, and
 * leaves every other section of the file as it stands.
 *
 * The plugin's diagnostics come from `--oxlint-report <file>` when it is given
 * — the JSON report `typescript check` already wrote for its own pass, so a
 * check runs oxlint once — and from the project's own oxlint otherwise (a
 * standalone run, a member run). A report path that names no file is refused.
 *
 * `--fix` applies the rewritable passes — C13, which moves a 16.x tree to 17
 * (bare ground folders, every file named by its path: `checker-migration.ts`),
 * C15, which moves a role folder at the specs root into `specs/shared/`, the
 * two document ones (key order and block scalars), C27, which moves ground
 * copied into several leaves up to the specs root's shared folder of its role,
 * C14, which MOVES a single-reader pool entry beside its leaf and rewrites the
 * literals that named it, and C12, which RENAMES a `.test.ts`
 * under a facet folder to `.spec.ts` — then checks what is left, so a run that
 * fixes everything exits 0. The ratchet run under `--fix` applies this
 * package's own oxlint autofixes before it counts the plugin's diagnostics
 * (`ratchet-own-fixes.ts`), so one `make fix` settles what they write — and it
 * refuses `--oxlint-report`, a report of the tree before them. It also re-records every
 * entry whose count fell — lowered, or dropped at zero — and never one that
 * rose. With no path it applies them to every `specs/` root
 * it discovers, and moves the module tests of every member that still stand on
 * a 16 folder: `--fix` means the same thing whichever run the operator typed.
 *
 * After a C12 rename it NAMES the entries of the owning member's configs that
 * the rename BROKE — a glob whose prefix covers a file it moved, or a literal
 * naming one — and nothing else. An entry the rename left behind collects
 * nothing, the run stays green with fewer files, and nothing else in the
 * toolchain would have said a word.
 *
 * Every move — C12's, C13's, C14's, C15's, C27's — goes through `git mv` where the tree is a
 * git working tree, so the history follows the file across a migration that
 * touches hundreds of them and the moved file stays in the listing the next
 * check walks; outside one it falls back to a plain rename.
 */

const cliArguments = process.argv.slice(2);
const recording = cliArguments[0] === 'baseline';
const argv = recording ? cliArguments.slice(1) : cliArguments;
const fix = argv.includes('--fix');
const json = valueOf('--format') === 'json';
const verbose = argv.includes('--verbose');
const member = valueOf('--member');
const oxlintReport = valueOf('--oxlint-report');
/** The flags that take a value: the argument after one is that value, never a path. */
const VALUED_FLAGS = new Set(['--format', '--member', '--oxlint-report']);
const positional = argv.find(
    (argument, index) => !argument.startsWith('--') && !VALUED_FLAGS.has(argv[index - 1] ?? ''),
);

/** The value of `--flag value` or `--flag=value`, or undefined. */
function valueOf(flag: string): string | undefined {
    const inline = argv.find((argument) => argument.startsWith(`${flag}=`));
    if (inline !== undefined) {
        return inline.slice(flag.length + 1);
    }
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
}

/**
 * What a run names when it is clean — the pass REGISTRY, never a sentence
 * written beside it.
 *
 * The hand-written list stopped at the cross-file passes of 15.x while the
 * channel grew four tree passes and a suppression gate, so the summary
 * under-reported exactly what it exists to report.
 */
const TREE_PASSES = TREE_PASS_IDS.join(', ');
/** The passes a member run puts over a package. */
const MEMBER_PASSES = MEMBER_PASS_IDS.join(', ');
/** The passes the whole-project run puts over it: each named once, though two run in both. */
const PROJECT_PASSES = CHECKER_PASS_IDS.join(', ');

/**
 * The project whose ratchet judges a partial run: the directory the run was
 * started from, where `typescript check` starts every run it makes, when it
 * keeps a `test` section in `jterrazz.baseline.json`. A run started anywhere
 * else judges itself.
 */
function judgingProject(): string | undefined {
    return keepsBaseline(process.cwd()) ? process.cwd() : undefined;
}

/** The published code of a finding — the key the ratchet records it under. */
function codeOfFinding(violation: TokenViolation): string {
    // The published code is the CONVENTION code — the id's first segment —
    // Whatever a pass calls itself internally: two spellings of one rule would
    // Be two lines of debt.
    return `${CHECKER_NAMESPACE}(${codeOf(violation.rule)})`;
}

/** A plugin diagnostic on the checker's own report line, as oxlint's pass would print it. */
function formatDiagnostic({
    code,
    column,
    file,
    line,
    message,
    severity,
}: PluginDiagnostic): string {
    return `${file}:${line}:${column}: ${severity === 'error' ? 'error' : 'warning'} ${code}: ${message}`;
}

/**
 * The lines that stand for the plugin's diagnostics a run judges. Read from a
 * report `--oxlint-report` hands in, they are one count: the pass that wrote
 * the report prints each of them. Read from an oxlint the checker ran itself,
 * no other pass saw them, and each is printed in full.
 */
function pluginLines(plugin: PluginDiagnostic[]): string[] {
    if (oxlintReport === undefined) {
        return plugin.map(formatDiagnostic);
    }
    return plugin.length > 0
        ? [
              `conventions checker: ${plugin.length} plugin diagnostic(s) judged, printed by oxlint's own pass`,
          ]
        : [];
}

/**
 * Print the findings: one JSON array of the checker's own, or the lines a
 * human reads — the plugin's diagnostics after them, when the run judges any.
 */
function printFindings(violations: TokenViolation[], plugin: PluginDiagnostic[] = []): void {
    if (json) {
        console.log(
            JSON.stringify(
                violations.map((violation) => ({
                    code: codeOfFinding(violation),
                    file: violation.file,
                    line: violation.line,
                    message: messageOf(violation),
                    severity: violation.severity,
                })),
            ),
        );
        return;
    }
    const lines = [...violations.map(formatViolation), ...pluginLines(plugin)];
    if (lines.length > 0) {
        const failing =
            violations.some(({ severity }) => severity === 'error') ||
            plugin.some(({ severity }) => severity === 'error');
        (failing ? console.error : console.warn)(lines.join('\n'));
    }
}

/** The one line a green run prints when the `test` section is absent or holds nothing. */
const NOTHING_HELD = `${BASELINE_LABEL}: nothing held`;

/** A line of the verdict, on the stream a human reads it from; never in the JSON. */
function say(line: string): void {
    if (!json) {
        console.error(line);
    }
}

/**
 * Print the findings and exit on the first error-level one. `passes` names the
 * ones that ACTUALLY ran: a member run that claimed the tree passes would be
 * telling the reader a `specs/` tree was judged when none was walked.
 *
 * `deferredTo` is the project root whose `jterrazz.baseline.json` judges this run's
 * findings: the run reports them and exits 0, the ratchet run decides.
 */
function report(
    violations: TokenViolation[],
    what: string,
    passes: string,
    deferredTo?: string,
): never {
    printFindings(violations);
    verdict(violations, what, passes, deferredTo);
}

/** The verdict of a run whose findings are printed: exit 1 on an error, unless another run judges them. */
function verdict(
    violations: TokenViolation[],
    what: string,
    passes: string,
    deferredTo?: string,
): never {
    const errors = violations.filter((violation) => violation.severity === 'error');
    if (deferredTo !== undefined && violations.length > 0) {
        say(
            `conventions checker: ${violations.length} finding(s) ${what}, judged by ${relative(process.cwd(), join(deferredTo, BASELINE_FILE)) || BASELINE_FILE} › test`,
        );
        process.exit(0);
    }
    if (errors.length > 0) {
        say(`\nconventions checker: ${errors.length} error(s) found ${what}`);
        process.exit(1);
    }
    if (!json) {
        console.log(
            verbose ? `${NOTHING_HELD} — conventions checker ${what} (${passes})` : NOTHING_HELD,
        );
    }
    process.exit(0);
}

/** What a ratchet run judges — the project's findings under a file, its own without one. */
type RatchetRun = {
    /** Every finding of the project: what the file counts. */
    counted: () => TokenViolation[];
    /** What the run itself found: what it judges when the project keeps no file. */
    own: TokenViolation[];
    passes: string;
    plugin: PluginDiagnostic[];
    root: string;
    what: string;
};

/**
 * The ratchet run's verdict: the project's findings and its plugin diagnostics,
 * counted against `jterrazz.baseline.json › test` at `root` — or, with no section, its own
 * findings and the plugin diagnostics judged one by one. Either way it prints
 * its own findings and the plugin's as {@link pluginLines} prints them, so a
 * verdict and its evidence are one log beside oxlint's.
 */
function ratchet({ counted, own, passes, plugin, root, what }: RatchetRun): never {
    if (keepsBaseline(root)) {
        const findings = counted();
        const counts = countsOf([
            ...findings.map(codeOfFinding),
            ...plugin.map((diagnostic) => diagnostic.code),
        ]);
        const baseline = fix ? reRecorded(root, counts) : readBaseline(root);
        const broken = judge(counts, baseline);
        if (json || broken.length > 0) {
            printFindings(findings, plugin);
        }
        for (const reason of broken) {
            say(`baseline-ratchet  ${BASELINE_LABEL}  ${reason}`);
        }
        if (broken.length > 0) {
            say("Run 'jterrazz-test-check baseline' to record where the project stands.");
            process.exit(1);
        }
        if (!json) {
            console.log(heldSummary(baseline, what, passes));
        }
        process.exit(0);
    }
    printFindings(own, plugin);
    const unrecorded = countsOf(plugin.map((diagnostic) => diagnostic.code));
    for (const [key, count] of Object.entries(unrecorded).toSorted(([a], [b]) =>
        a < b ? -1 : 1,
    )) {
        say(`${key}  ${count} diagnostic(s), and the project keeps no ${BASELINE_LABEL}`);
    }
    if (plugin.length > 0) {
        say("Fix them, or run 'jterrazz-test-check baseline' to record where the project stands.");
        process.exit(1);
    }
    verdict(own, what, passes);
}

/**
 * Under `--fix`, record every entry whose count fell — lowered, or dropped at
 * zero — and name each; a count that rose is left for the verdict. Returns the
 * section the verdict judges against.
 */
function reRecorded(root: string, counts: Record<string, number>): Record<string, number> {
    const held = readBaseline(root);
    const next = tightened(counts, held);
    if (next === undefined) {
        return held;
    }
    writeBaseline(root, next);
    for (const [key, allowed] of Object.entries(held).toSorted(([a], [b]) => (a < b ? -1 : 1))) {
        if (!json && (next[key] ?? 0) !== allowed) {
            console.log(
                `conventions checker: re-recorded ${BASELINE_LABEL} › ${key} ${allowed} → ${next[key] ?? 0}`,
            );
        }
    }
    return readBaseline(root);
}

/**
 * The one line a green ratchet run prints: what the section holds, by count
 * and by rule — the run's `routes/unreached` with the checker's own — or
 * {@link NOTHING_HELD} for a section that holds nothing — and, asked for with
 * `--verbose`, what ran and where. The findings themselves print only with a
 * failing verdict, where they are the evidence.
 */
function heldSummary(baseline: Record<string, number>, what: string, passes: string): string {
    const entries = Object.values(baseline).filter((count) => count > 0);
    const rules = entries.length;
    const total = entries.reduce((sum, count) => sum + count, 0);
    const held =
        rules === 0
            ? NOTHING_HELD
            : `${BASELINE_LABEL}: ${total} held across ${rules} rule${rules === 1 ? '' : 's'}`;
    return verbose ? `${held} — conventions checker ${what} (${passes})` : held;
}

/** A directory that must exist — a typo'd path is operator error, not a clean tree. */
function requireDirectory(path: string, what: string): string {
    const resolved = resolve(path);
    if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
        console.error(`conventions checker: no such ${what}: ${resolved}`);
        process.exit(1);
    }
    return resolved;
}

/**
 * Under `--fix`, every rewrite of the project at `root`, before anything is
 * counted: the rewritable passes over each `specs/` root, the members' 16 → 17
 * movers, then the plugin's own autofixes (`ratchet-own-fixes.ts`) — so the
 * checker's findings and the plugin's diagnostics are counted over one tree.
 */
function fixProject(root: string): void {
    if (!fix) {
        return;
    }
    for (const specsRoot of discoverSpecRoots(root)) {
        applyFixes(specsRoot);
    }
    for (const memberDir of discoverMembers(root)) {
        reportMigration(migrateModuleTestsTo17(memberDir, moveKeepingHistory));
        for (const move of migrateLintConfig(memberDir, root)) {
            reportLintConfigMove(move);
        }
    }
    applyOwnFixes(root);
}

/** Every finding of the project at `root`: each `specs/` root it discovers, and every member. */
function projectFindings(root: string): TokenViolation[] {
    const found: TokenViolation[] = [];
    for (const specsRoot of discoverSpecRoots(root)) {
        const prefix = relative(root, specsRoot);
        for (const violation of runAllChecks(specsRoot)) {
            // A tree pass reports relative to the tree it walked; the
            // Project-wide run has to say WHICH tree, or two members' findings
            // Read alike.
            found.push({ ...violation, file: `${prefix}/${violation.file}` });
        }
    }
    found.push(...checkMembers(root));
    return found;
}

/** A rename the mover performed, as absolute paths. */
type Rename = { from: string; to: string };

/** C12's mover: every `.test.ts` under a facet folder becomes a `.spec.ts`. */
function fixSpecSuffixes(root: string): Rename[] {
    const renamed: Rename[] = [];
    for (const { from, to } of movesUnderFacet(root)) {
        if (to === undefined || existsSync(to)) {
            continue;
        }
        moveKeepingHistory(from, to);
        renamed.push({ from, to });
    }
    return renamed;
}

/** Where a member states what it collects, whatever extension it writes it in. */
const CONFIG_NAMES = [
    'vitest.config.ts',
    'vitest.config.mts',
    'vitest.config.cts',
    'vitest.config.js',
    'vitest.config.mjs',
    'vitest.config.cjs',
];

/** What a config COLLECTS: the two keys whose entries name test files. */
const COLLECTION = /\b(?:include|exclude)\s*:\s*\[(?<entries>[^\]]*)\]/gu;

/** One quoted entry of such a list. */
const ENTRY = /['"`](?<entry>[^'"`\n]*)['"`]/gu;

/** The quotes a config's entries are written in. */
const QUOTES = new Set(["'", '"', '`']);

/** The index of the newline ending the `//` comment that starts at `index`. */
function endOfLineComment(text: string, index: number): number {
    const newline = text.indexOf('\n', index);
    return newline === -1 ? text.length : newline;
}

/** The index just past the block comment that starts at `index`. */
function endOfBlockComment(text: string, index: number): number {
    const close = text.indexOf('*/', index + 2);
    return close === -1 ? text.length : close + 2;
}

/**
 * The config, with what is not code taken out.
 *
 * A notice that read a COMMENT as an include told signews-mobile to follow a
 * glob no project collected on. The scan is character by character because a
 * regex cannot tell the two apart: `specs/api/**` + `/*.test.ts` opens a block
 * comment to any pattern that does not know it is inside a string, and a `://`
 * opens a line comment to one that does not either.
 */
function withoutComments(text: string): string {
    let out = '';
    let quote: null | string = null;
    let index = 0;
    while (index < text.length) {
        const char = text[index] ?? '';
        const pair = text.slice(index, index + 2);
        if (quote !== null) {
            const escaped = char === '\\';
            out += escaped ? pair : char;
            quote = char === quote ? null : quote;
            index += escaped ? 2 : 1;
        } else if (pair === '//') {
            out += '\n';
            index = endOfLineComment(text, index);
        } else if (pair === '/*') {
            index = endOfBlockComment(text, index);
        } else {
            quote = QUOTES.has(char) ? char : null;
            out += char;
            index += 1;
        }
    }
    return out;
}

/**
 * Does this entry of a config sitting in `dir` reach `file`?
 *
 * A glob reaches what its literal PREFIX — everything before the first `*` —
 * contains; an entry with no `*` reaches the one file it names. Both are
 * resolved against the config's own directory, which is what vitest does.
 */
function reaches(dir: string, entry: string, file: string): boolean {
    const star = entry.indexOf('*');
    if (star === -1) {
        return resolve(dir, entry) === file;
    }
    const prefix = resolve(dir, entry.slice(0, star));
    return file === prefix || file.startsWith(`${prefix}/`);
}

/** Every entry of every `include`/`exclude` list a config states. */
function collectedEntries(text: string): string[] {
    const entries: string[] = [];
    for (const list of text.matchAll(COLLECTION)) {
        for (const match of (list.groups?.entries ?? '').matchAll(ENTRY)) {
            entries.push(match.groups?.entry ?? '');
        }
    }
    return entries;
}

/** What one broken entry says, glob or literal. */
function noticeFor(where: string, entry: string): string {
    return entry.includes('*')
        ? `${where}: ${entry} still names \`.test.ts\` — the files it collected are \`.spec.ts\` now, and the project collects nothing until the glob follows (C12)`
        : `${where}: ${entry} names a file this run renamed — it is \`${entry.slice(0, -'.test.ts'.length)}.spec.ts\` now, and the entry collects nothing until it follows (C12)`;
}

/** The entries of ONE config the renames broke. */
function staleEntriesIn(path: string, owner: string, renamed: Rename[]): string[] {
    const directory = dirname(path);
    return collectedEntries(withoutComments(readFileSync(path, 'utf8')))
        .filter((entry) => entry.endsWith('.test.ts'))
        .filter((entry) => renamed.some(({ from }) => reaches(directory, entry, from)))
        .map((entry) => noticeFor(relative(owner, path), entry));
}

/**
 * The entries a rename leaves behind.
 *
 * A consumer that names its suffix in an `include` loses the whole suite the
 * moment the mover renames it: vitest collects fewer files, exits 0, and the
 * only trace is a number nobody compares. The mover owns that consequence —
 * it cannot rewrite a config it does not parse, so it NAMES what it broke, and
 * the author updates it in the same commit as the rename.
 *
 * What it names is exactly what it broke: an entry of an `include`/`exclude`
 * list, never a comment, and only where the entry reaches a file this run
 * actually moved. A glob over `src/` collecting module tests the mover never
 * touched is not a stale glob, and four repositories of the wave were told it
 * was — one of them would have emptied its unit project by following the
 * notice.
 */
function staleIncludes(root: string, renamed: Rename[]): string[] {
    if (renamed.length === 0) {
        return [];
    }
    const owner = packageRootOf(root) ?? dirname(root);
    const paths = [...new Set([root, owner, dirname(root)])].flatMap((directory) =>
        CONFIG_NAMES.map((name) => join(directory, name)).filter((path) => existsSync(path)),
    );
    return paths.flatMap((path) => staleEntriesIn(path, owner, renamed));
}

/** Print what the 16 → 17 mover did. */
function reportMigration(migration: Migration): void {
    for (const move of migration.renamed) {
        console.log(`conventions checker: renamed ${move} (C13)`);
    }
    if (migration.rewritten.length > 0) {
        console.log(
            `conventions checker: named ${migration.rewritten.length} file(s)' ground by path (C13)`,
        );
    }
    if (migration.directives.length > 0) {
        console.log(
            `conventions checker: renamed the directives naming a renamed rule in ${migration.directives.length} file(s)`,
        );
    }
    if (migration.stubs.length > 0) {
        console.log(
            `conventions checker: named the stubs of ${migration.stubs.length} file(s) as 17 does — defineStub, stubs/, *.stubs.ts (C13)`,
        );
    }
}

/** Print what the 16 → 17 mover did to one oxlint config. */
function reportLintConfigMove({ file, removed, renamed }: LintConfigMove): void {
    for (const id of renamed) {
        console.log(
            `conventions checker: ${file} — the override of jterrazz/${id} names its 17 id`,
        );
    }
    for (const id of removed) {
        console.log(
            `conventions checker: ${file} — removed the override of jterrazz/${id}, a rule 17 retired`,
        );
    }
}

/** Apply every rewritable pass over one tree, printing what it did. */
function applyFixes(root: string): void {
    reportMigration(migrateTo17(root, moveKeepingHistory));
    for (const move of fixRootGround(root)) {
        console.log(`conventions checker: moved ${move} (C15)`);
    }
    const renamed = fixSpecSuffixes(root);
    for (const { from, to } of renamed) {
        console.log(
            `conventions checker: renamed ${relative(root, from)} → ${relative(root, to)} (C12)`,
        );
    }
    for (const stale of staleIncludes(root, renamed)) {
        console.log(`conventions checker: ${stale}`);
    }
    const written = fixSpecFiles(root);
    if (written.length > 0) {
        console.log(`conventions checker: rewrote ${written.length} spec document(s)`);
    }
    for (const change of fixSubjects(root)) {
        console.log(`conventions checker: moved ${change} (C29/C30)`);
    }
    for (const move of fixCopiedGround(root)) {
        console.log(`conventions checker: moved ${move} (C27)`);
    }
    for (const change of fixGroundSharing(root)) {
        console.log(`conventions checker: ${change} (C28)`);
    }
}

/**
 * Is this directory a specs tree?
 *
 * The `specs` SEGMENT is the anchor every other pass reads (`specsAnchor`), so
 * the CLI reads it too, below the project root that holds the directory:
 * `specs`, `apps/web/specs` and `specs/api` are trees — a subtree of one is
 * still inside it — and everything else is a project root holding zero or more
 * of them, a checkout under a folder named `specs/` included.
 */
function isSpecsTree(dir: string): boolean {
    const owner = projectRootOf(dir);
    return (owner === undefined ? dir : relative(owner, dir)).split(/[/\\]/u).includes('specs');
}

/** The report `--oxlint-report` names, which must be a file — a typo'd path would count nothing. */
function requireReport(path: string | undefined): string | undefined {
    if (path === undefined) {
        return undefined;
    }
    const resolved = resolve(path);
    if (!existsSync(resolved) || !statSync(resolved).isFile()) {
        console.error(`conventions checker: no such oxlint report: ${resolved}`);
        process.exit(1);
    }
    return resolved;
}

const reportFile = requireReport(oxlintReport);
if (fix && reportFile !== undefined) {
    console.error(
        'conventions checker: `--fix` counts what its own fixes leave, and a report written before them counts the tree they changed — drop `--oxlint-report`',
    );
    process.exit(1);
}

// ── Record the ratchet ──

if (recording) {
    const root = requireDirectory(positional ?? '.', 'project root');
    const findings = projectFindings(root);
    const plugin = pluginDiagnostics(root, reportFile);
    const counts = countsOf([
        ...findings.map(codeOfFinding),
        ...plugin.map((diagnostic) => diagnostic.code),
    ]);
    writeBaseline(root, counts);
    console.log(
        `${BASELINE_LABEL} written — ${findings.length + plugin.length} finding(s) across ${Object.keys(counts).length} rule(s)`,
    );
    process.exit(0);
}

// ── One member ──

if (member !== undefined) {
    const root = resolve(positional ?? '.');
    const dir = requireDirectory(member, 'member directory');
    const what = `for member ${relative(root, dir) || '.'}`;
    if (dir === root) {
        // The project root's own member run — the one `typescript check`
        // Always makes — is the ratchet run: it judges, and prints, the whole
        // Project's counts where a file keeps them.
        fixProject(root);
        ratchet({
            counted: () => projectFindings(root),
            own: checkMember(dir, root),
            passes: MEMBER_PASSES,
            plugin: pluginDiagnostics(root, reportFile),
            root,
            what,
        });
    }
    report(checkMember(dir, root), what, MEMBER_PASSES, judgingProject());
}

// ── One specs tree ──

if (positional !== undefined && isSpecsTree(requireDirectory(positional, 'directory'))) {
    const root = requireDirectory(positional, 'directory');
    if (fix) {
        applyFixes(root);
    }
    report(runAllChecks(root), `under ${root}`, TREE_PASSES, judgingProject());
}

// ── The whole project: every specs root, every member ──

const root = positional === undefined ? resolve('.') : requireDirectory(positional, 'directory');
if (positional !== undefined && discoverSpecRoots(root).length === 0) {
    console.error(
        `conventions checker: no \`specs/\` tree under ${root} — name a specs tree, or a project root that holds one`,
    );
    process.exit(1);
}
fixProject(root);
const findings = projectFindings(root);
ratchet({
    counted: () => findings,
    own: findings,
    passes: PROJECT_PASSES,
    plugin: pluginDiagnostics(root, reportFile),
    root,
    what: `under ${root}`,
});
