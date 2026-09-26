#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { moveKeepingHistory } from '../../src/kernel/files/git-tree.js';
import { migrateBaselineKeys } from '../migration/baseline-keys.js';
import type { BaselineKeysMove } from '../migration/baseline-keys.js';
import {
    migrateDirectives,
    migrateLintConfig,
    migrateModuleTestsTo17,
    migrateTo17,
} from '../migration/mover.js';
import type { LintConfigMove, Migration } from '../migration/mover.js';
import {
    BASELINE_FILE,
    BASELINE_LABEL,
    countsOf,
    judge,
    keepsBaseline,
    readBaseline,
    writeBaseline,
} from '../ratchet/baseline.js';
import { tightened } from '../ratchet/fix.js';
import { projectRootOf } from '../reading/role.js';
import {
    CHECKER_NAMESPACE,
    CHECKER_PASS_IDS,
    formatViolation,
    MEMBER_PASS_IDS,
    messageOf,
    runAllChecks,
    TREE_PASS_IDS,
} from './checker.js';
import type { Finding } from './checker.js';
import { fixSpecFiles } from './documents.js';
import { movesUnderFacet } from './file-suffix-matches-place.js';
import { staleIncludes } from './file-suffix-matches-place.stale-includes.js';
import type { Rename } from './file-suffix-matches-place.stale-includes.js';
import { fixGroundSharedOrInline } from './ground-shared-or-inline.js';
import { checkMember, checkMembers, discoverMembers, discoverSpecRoots } from './members.js';
import { fixDuplicateGround } from './no-duplicate-ground.js';
import { fixNoReachIntoSiblingGround } from './no-reach-into-sibling-ground.js';
import { applyOwnFixes } from './own-fixes.js';
import { pluginDiagnostics } from './oxlint-run.js';
import type { PluginDiagnostic } from './oxlint-run.js';
import { fixSubjects } from './subject-moves.js';

/* oxlint-disable eslint/no-console -- this file IS the CLI: its output is the product, and a reporter that wrote anywhere else would be reporting to nobody. */
/**
 *     node dist/checker.js [dir] [--fix]              # a specs tree, or a project root
 *     node dist/checker.js --format json              # every root, every member
 *     node dist/checker.js --member <dir>             # one workspace member
 *     node dist/checker.js baseline [root]            # record jterrazz.baseline.json › test
 *     node dist/checker.js … --oxlint-report <file>   # read the plugin's diagnostics from a report
 *     node dist/checker.js … --verbose                # a green ratchet run also names where it stood and what ran
 *
 * The run over the whole project owns the ratchet verdict; every other run under a project keeping a baseline reports and defers to it. Every move goes through `git mv` in a work tree, so history follows the file.
 */

const cliArguments = process.argv.slice(2);
const recording = cliArguments[0] === 'baseline';
const argv = recording ? cliArguments.slice(1) : cliArguments;
const fix = argv.includes('--fix');
const json = valueOf('--format') === 'json';
const verbose = argv.includes('--verbose');
const member = valueOf('--member');
const oxlintReport = valueOf('--oxlint-report');
const VALUED_FLAGS = new Set(['--format', '--member', '--oxlint-report']);
const positional = argv.find(
    (argument, index) => !argument.startsWith('--') && !VALUED_FLAGS.has(argv[index - 1] ?? ''),
);

function valueOf(flag: string): string | undefined {
    const inline = argv.find((argument) => argument.startsWith(`${flag}=`));
    if (inline !== undefined) {
        return inline.slice(flag.length + 1);
    }
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
}

const TREE_PASSES = TREE_PASS_IDS.join(', ');
const MEMBER_PASSES = MEMBER_PASS_IDS.join(', ');
const PROJECT_PASSES = CHECKER_PASS_IDS.join(', ');

/** Where `typescript check` starts every run it makes, when that project keeps a `test` section in `jterrazz.baseline.json`; a run started anywhere else judges itself. */
function judgingProject(): string | undefined {
    return keepsBaseline(process.cwd()) ? process.cwd() : undefined;
}

function printedRuleOf(violation: Finding): string {
    return `${CHECKER_NAMESPACE}(${violation.rule})`;
}

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

/** From a `--oxlint-report` they are one count, since the pass that wrote the report prints each; from an oxlint run here, no other pass saw them, so each prints in full. */
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

function printFindings(violations: Finding[], plugin: PluginDiagnostic[] = []): void {
    if (json) {
        console.log(
            JSON.stringify(
                violations.map((violation) => ({
                    code: printedRuleOf(violation),
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

const NOTHING_HELD = `${BASELINE_LABEL}: nothing held`;

function say(line: string): void {
    if (!json) {
        console.error(line);
    }
}

/** `passes` names only the passes that ran; with `deferredTo`, the project root's baseline judges the findings and this run exits 0. */
function report(violations: Finding[], what: string, passes: string, deferredTo?: string): never {
    printFindings(violations);
    verdict(violations, what, passes, deferredTo);
}

function verdict(violations: Finding[], what: string, passes: string, deferredTo?: string): never {
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

type RatchetRun = {
    counted: () => Finding[];
    own: Finding[];
    passes: string;
    plugin: PluginDiagnostic[];
    root: string;
    what: string;
};

function ratchet({ counted, own, passes, plugin, root, what }: RatchetRun): never {
    if (keepsBaseline(root)) {
        const findings = counted();
        const counts = countsOf([
            ...findings.map(printedRuleOf),
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

/** Records only counts that fell (lowered, or dropped at zero); one that rose is left for the verdict. */
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

/** A typo'd path is operator error, not a clean tree. */
function requireDirectory(path: string, what: string): string {
    const resolved = resolve(path);
    if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
        console.error(`conventions checker: no such ${what}: ${resolved}`);
        process.exit(1);
    }
    return resolved;
}

/** Every rewrite lands before anything is counted, so the checker's findings and the plugin's diagnostics are counted over one tree. */
function fixProject(root: string): void {
    if (!fix) {
        return;
    }
    for (const specsRoot of discoverSpecRoots(root)) {
        applyFixes(specsRoot);
    }
    for (const memberDir of discoverMembers(root)) {
        reportMigration(migrateModuleTestsTo17(memberDir, moveKeepingHistory));
        reportMigration({
            directives: migrateDirectives(memberDir),
            renamed: [],
            rewritten: [],
            stubs: [],
        });
        for (const move of migrateLintConfig(memberDir, root)) {
            reportLintConfigMove(move);
        }
    }
    for (const dir of new Set([root, ...discoverMembers(root)])) {
        for (const move of migrateBaselineKeys(dir)) {
            reportBaselineKeysMove(relative(root, join(dir, move.file)), move);
        }
    }
    applyOwnFixes(root);
}

function projectFindings(root: string): Finding[] {
    const found: Finding[] = [];
    for (const specsRoot of discoverSpecRoots(root)) {
        const prefix = relative(root, specsRoot);
        for (const violation of runAllChecks(specsRoot)) {
            // The project-wide run names the tree a finding came from, or two members' findings read alike.
            found.push({ ...violation, file: `${prefix}/${violation.file}` });
        }
    }
    found.push(...checkMembers(root));
    return found;
}

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

function reportMigration(migration: Migration): void {
    for (const move of migration.renamed) {
        console.log(`conventions checker: renamed ${move} (ground-uses-reserved-name)`);
    }
    if (migration.rewritten.length > 0) {
        console.log(
            `conventions checker: named ${migration.rewritten.length} file(s)' ground by path (ground-uses-reserved-name)`,
        );
    }
    if (migration.directives.length > 0) {
        console.log(
            `conventions checker: renamed the directives naming a renamed rule in ${migration.directives.length} file(s)`,
        );
    }
    if (migration.stubs.length > 0) {
        console.log(
            `conventions checker: named the stubs of ${migration.stubs.length} file(s) as 17 does — defineStub, stubs/, *.stubs.ts (ground-uses-reserved-name)`,
        );
    }
}

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

function reportBaselineKeysMove(file: string, { renamed, shared }: BaselineKeysMove): void {
    for (const key of renamed) {
        console.log(`conventions checker: ${file} — ${key} is keyed by its rule's name`);
    }
    for (const key of shared) {
        console.log(
            `conventions checker: ${file} — ${key} counted several passes under one code; run 'jterrazz-test-check baseline' to record each by its name`,
        );
    }
}

function applyFixes(root: string): void {
    reportMigration(migrateTo17(root, moveKeepingHistory));
    for (const move of fixNoReachIntoSiblingGround(root)) {
        console.log(`conventions checker: moved ${move} (no-reach-into-sibling-ground)`);
    }
    const renamed = fixSpecSuffixes(root);
    for (const { from, to } of renamed) {
        console.log(
            `conventions checker: renamed ${relative(root, from)} → ${relative(root, to)} (file-suffix-matches-place)`,
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
        console.log(
            `conventions checker: moved ${change} (one-subject-per-spec, spec-in-subject-folder)`,
        );
    }
    for (const move of fixDuplicateGround(root)) {
        console.log(`conventions checker: moved ${move} (no-duplicate-ground)`);
    }
    for (const change of fixGroundSharedOrInline(root)) {
        console.log(`conventions checker: ${change} (ground-shared-or-inline)`);
    }
}

/** The `specs` segment below the project root is the anchor every pass reads (`specsAnchor`); anything else is a project root holding zero or more trees. */
function isSpecsTree(dir: string): boolean {
    const owner = projectRootOf(dir);
    return (owner === undefined ? dir : relative(owner, dir)).split(/[/\\]/u).includes('specs');
}

/** A typo'd path would count nothing. */
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

if (recording) {
    const root = requireDirectory(positional ?? '.', 'project root');
    const findings = projectFindings(root);
    const plugin = pluginDiagnostics(root, reportFile);
    const counts = countsOf([
        ...findings.map(printedRuleOf),
        ...plugin.map((diagnostic) => diagnostic.code),
    ]);
    writeBaseline(root, counts);
    console.log(
        `${BASELINE_LABEL} written — ${findings.length + plugin.length} finding(s) across ${Object.keys(counts).length} rule(s)`,
    );
    process.exit(0);
}

if (member !== undefined) {
    const root = resolve(positional ?? '.');
    const dir = requireDirectory(member, 'member directory');
    const what = `for member ${relative(root, dir) || '.'}`;
    if (dir === root) {
        // The project root's own member run, the one `typescript check` always makes, is the ratchet run.
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

if (positional !== undefined && isSpecsTree(requireDirectory(positional, 'directory'))) {
    const root = requireDirectory(positional, 'directory');
    if (fix) {
        applyFixes(root);
    }
    report(runAllChecks(root), `under ${root}`, TREE_PASSES, judgingProject());
}

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
