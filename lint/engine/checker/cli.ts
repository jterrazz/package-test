import { existsSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { tightened } from '../baseline/fix.js';
import {
    BASELINE_FILE,
    BASELINE_LABEL,
    countsOf,
    judge,
    keepsBaseline,
    readBaseline,
    writeBaseline,
} from '../baseline/ratchet.js';
import { discoverSpecRoots } from '../project/members.js';
import { projectRootOf } from '../project/role.js';
import { CHECKER_NAMESPACE } from './finding.js';
import type { Finding } from './finding.js';
import { runMember, runMembers } from './member-run.js';
import { applyOwnFixes } from './own-fixes.js';
import type { CheckerRegistry } from './registry.js';
import { stop } from './stop.js';
import { checkerLine, checkerMessage, runTree } from './tree-run.js';

/* oxlint-disable eslint/no-console -- this file IS the CLI: its output is the product, and a reporter that wrote anywhere else would be reporting to nobody. */
/**
 *     node dist/checker.js [dir] [--fix]              # a specs tree, or a project root
 *     node dist/checker.js --format json              # every root, every member
 *     node dist/checker.js --member <dir>             # one workspace member
 *     node dist/checker.js baseline [root]            # record jterrazz.baseline.json › test
 *     node dist/checker.js … --verbose                # a green ratchet run also names where it stood and what ran
 *
 * The run over the whole project owns the ratchet verdict; every other run under a project keeping a baseline reports and defers to it. Every move goes through `git mv` in a work tree, so history follows the file.
 */

type Run = {
    fix: boolean;
    json: boolean;
    registry: CheckerRegistry;
    verbose: boolean;
};

const VALUED_FLAGS = new Set(['--format', '--member']);

/** The plugin's rules are oxlint's own, held in oxlint-suppressions.json; the section holds the checker's passes alone. */
const PLUGIN_PREFIX = 'jterrazz/';

function valueOf(argv: readonly string[], flag: string): string | undefined {
    const inline = argv.find((argument) => argument.startsWith(`${flag}=`));
    if (inline !== undefined) {
        return inline.slice(flag.length + 1);
    }
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
}

/** Where `typescript check` starts every run it makes, when that project keeps a `test` section in `jterrazz.baseline.json`; a run started anywhere else judges itself. */
function judgingProject(): string | undefined {
    return keepsBaseline(process.cwd()) ? process.cwd() : undefined;
}

function printedRuleOf(violation: Finding): string {
    return `${CHECKER_NAMESPACE}(${violation.rule})`;
}

function printFindings(run: Run, violations: Finding[]): void {
    if (run.json) {
        console.log(
            JSON.stringify(
                violations.map((violation) => ({
                    code: printedRuleOf(violation),
                    file: violation.file,
                    line: violation.line,
                    message: checkerMessage(run.registry, violation),
                    severity: violation.severity,
                })),
            ),
        );
        return;
    }
    const lines = violations.map((violation) => checkerLine(run.registry, violation));
    if (lines.length > 0) {
        const failing = violations.some(({ severity }) => severity === 'error');
        (failing ? console.error : console.warn)(lines.join('\n'));
    }
}

const NOTHING_HELD = `${BASELINE_LABEL}: nothing held`;

function say(run: Run, line: string): void {
    if (!run.json) {
        console.error(line);
    }
}

type Verdict = { passes: string; what: string };

/** `passes` names only the passes that ran; with `deferredTo`, the project root's baseline judges the findings and this run exits 0. */
function report(run: Run, violations: Finding[], verdictOf: Verdict, deferredTo?: string): never {
    printFindings(run, violations);
    verdict(run, violations, verdictOf, deferredTo);
}

function verdict(
    run: Run,
    violations: Finding[],
    { passes, what }: Verdict,
    deferredTo?: string,
): never {
    const errors = violations.filter((violation) => violation.severity === 'error');
    if (deferredTo !== undefined && violations.length > 0) {
        say(
            run,
            `conventions checker: ${violations.length} finding(s) ${what}, judged by ${relative(process.cwd(), join(deferredTo, BASELINE_FILE)) || BASELINE_FILE} › test`,
        );
        stop(0);
    }
    if (errors.length > 0) {
        say(run, `\nconventions checker: ${errors.length} error(s) found ${what}`);
        stop(1);
    }
    if (!run.json) {
        console.log(
            run.verbose
                ? `${NOTHING_HELD} — conventions checker ${what} (${passes})`
                : NOTHING_HELD,
        );
    }
    stop(0);
}

type RatchetRun = Verdict & {
    counted: () => Finding[];
    own: Finding[];
    root: string;
};

function pluginKeysLeft(baseline: Readonly<Record<string, number>>): string[] {
    return Object.keys(baseline)
        .filter((key) => key.startsWith(PLUGIN_PREFIX))
        .toSorted()
        .map(
            (key) =>
                `${key} is the plugin's rule, which oxlint-suppressions.json holds now — run 'typescript baseline', then 'jterrazz-test-check baseline'`,
        );
}

function judgeHeld(run: Run, ratchetRun: RatchetRun): never {
    const { counted, passes, root, what } = ratchetRun;
    const findings = counted();
    const counts = countsOf(findings.map(printedRuleOf));
    const baseline = run.fix ? reRecorded(run, root, counts) : readBaseline(root);
    const left = pluginKeysLeft(baseline);
    const broken = [
        ...left,
        ...judge(
            counts,
            Object.fromEntries(
                Object.entries(baseline).filter(([key]) => !key.startsWith(PLUGIN_PREFIX)),
            ),
        ),
    ];
    if (run.json || broken.length > 0) {
        printFindings(run, findings);
    }
    for (const reason of broken) {
        say(run, `baseline-ratchet  ${BASELINE_LABEL}  ${reason}`);
    }
    if (broken.length > 0) {
        say(run, "Run 'jterrazz-test-check baseline' to record where the project stands.");
        stop(1);
    }
    if (!run.json) {
        console.log(heldSummary(run, baseline, { passes, what }));
    }
    stop(0);
}

function ratchet(run: Run, ratchetRun: RatchetRun): never {
    if (keepsBaseline(ratchetRun.root)) {
        judgeHeld(run, ratchetRun);
    }
    printFindings(run, ratchetRun.own);
    verdict(run, ratchetRun.own, ratchetRun);
}

/** Records only counts that fell (lowered, or dropped at zero); one that rose is left for the verdict. */
function reRecorded(
    run: Run,
    root: string,
    counts: Record<string, number>,
): Record<string, number> {
    const held = readBaseline(root);
    const next = tightened(counts, held);
    if (next === undefined) {
        return held;
    }
    writeBaseline(root, next);
    for (const [key, allowed] of Object.entries(held).toSorted(([a], [b]) => (a < b ? -1 : 1))) {
        if (!run.json && (next[key] ?? 0) !== allowed) {
            console.log(
                `conventions checker: re-recorded ${BASELINE_LABEL} › ${key} ${allowed} → ${next[key] ?? 0}`,
            );
        }
    }
    return readBaseline(root);
}

function heldSummary(
    run: Run,
    baseline: Record<string, number>,
    { passes, what }: Verdict,
): string {
    const entries = Object.values(baseline).filter((count) => count > 0);
    const rules = entries.length;
    const total = entries.reduce((sum, count) => sum + count, 0);
    const held =
        rules === 0
            ? NOTHING_HELD
            : `${BASELINE_LABEL}: ${total} held across ${rules} rule${rules === 1 ? '' : 's'}`;
    return run.verbose ? `${held} — conventions checker ${what} (${passes})` : held;
}

/** A typo'd path is operator error, not a clean tree. */
function requireDirectory(path: string, what: string): string {
    const resolved = resolve(path);
    if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
        console.error(`conventions checker: no such ${what}: ${resolved}`);
        stop(1);
    }
    return resolved;
}

function applyFixes(run: Run, root: string): void {
    for (const fix of run.registry.fixes) {
        for (const line of fix(root)) {
            console.log(`conventions checker: ${line}`);
        }
    }
}

/** Every rewrite lands before anything is counted, so the findings are counted over the tree the fixes left. */
function fixProject(run: Run, root: string): void {
    if (!run.fix) {
        return;
    }
    for (const specsRoot of discoverSpecRoots(root)) {
        applyFixes(run, specsRoot);
    }
    applyOwnFixes(root);
}

function projectFindings(run: Run, root: string): Finding[] {
    const found: Finding[] = [];
    for (const specsRoot of discoverSpecRoots(root)) {
        const prefix = relative(root, specsRoot);
        for (const violation of runTree(specsRoot, run.registry)) {
            // The project-wide run names the tree a finding came from, or two members' findings read alike.
            found.push({ ...violation, file: `${prefix}/${violation.file}` });
        }
    }
    found.push(...runMembers(root, run.registry));
    return found;
}

/** The `specs` segment below the project root is the anchor every pass reads (`specsAnchor`); anything else is a project root holding zero or more trees. */
function isSpecsTree(dir: string): boolean {
    const owner = projectRootOf(dir);
    return (owner === undefined ? dir : relative(owner, dir)).split(/[/\\]/u).includes('specs');
}

function recordBaseline(run: Run, positional: string | undefined): never {
    const root = requireDirectory(positional ?? '.', 'project root');
    const findings = projectFindings(run, root);
    const counts = countsOf(findings.map(printedRuleOf));
    writeBaseline(root, counts);
    console.log(
        `${BASELINE_LABEL} written — ${findings.length} finding(s) across ${Object.keys(counts).length} rule(s)`,
    );
    stop(0);
}

function checkMemberRun(run: Run, member: string, positional?: string): never {
    const root = resolve(positional ?? '.');
    const dir = requireDirectory(member, 'member directory');
    const what = `for member ${relative(root, dir) || '.'}`;
    const passes = run.registry.memberPassIds.join(', ');
    if (dir === root) {
        // The project root's own member run, the one `typescript check` always makes, is the ratchet run.
        fixProject(run, root);
        ratchet(run, {
            counted: () => projectFindings(run, root),
            own: runMember(dir, root, run.registry),
            passes,
            root,
            what,
        });
    }
    report(run, runMember(dir, root, run.registry), { passes, what }, judgingProject());
}

function checkProject(run: Run, positional: string | undefined): never {
    const root =
        positional === undefined ? resolve('.') : requireDirectory(positional, 'directory');
    if (positional !== undefined && discoverSpecRoots(root).length === 0) {
        console.error(
            `conventions checker: no \`specs/\` tree under ${root} — name a specs tree, or a project root that holds one`,
        );
        stop(1);
    }
    fixProject(run, root);
    const findings = projectFindings(run, root);
    ratchet(run, {
        counted: () => findings,
        own: findings,
        passes: [...new Set([...run.registry.treePassIds, ...run.registry.memberPassIds])].join(
            ', ',
        ),
        root,
        what: `under ${root}`,
    });
}

export function runCheckerCli(registry: CheckerRegistry, cliArguments: readonly string[]): never {
    const recording = cliArguments[0] === 'baseline';
    const argv = recording ? cliArguments.slice(1) : cliArguments;
    const run: Run = {
        fix: argv.includes('--fix'),
        json: valueOf(argv, '--format') === 'json',
        registry,
        verbose: argv.includes('--verbose'),
    };
    const member = valueOf(argv, '--member');
    const positional = argv.find(
        (argument, index) => !argument.startsWith('--') && !VALUED_FLAGS.has(argv[index - 1] ?? ''),
    );

    if (recording) {
        recordBaseline(run, positional);
    }
    if (member !== undefined) {
        checkMemberRun(run, member, positional);
    }
    if (positional !== undefined && isSpecsTree(requireDirectory(positional, 'directory'))) {
        const root = requireDirectory(positional, 'directory');
        if (run.fix) {
            applyFixes(run, root);
        }
        report(
            run,
            runTree(root, registry),
            { passes: registry.treePassIds.join(', '), what: `under ${root}` },
            judgingProject(),
        );
    }
    checkProject(run, positional);
}
