import { BASELINE, keepsSection, labelOf, refusal, sectionOf } from '@jterrazz/typescript/rules';
import type { Context, Finding, Pass, PassResult } from '@jterrazz/typescript/rules';
import { existsSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { BASELINE_SECTION } from '../baseline/ratchet.js';
import { discoverSpecRoots } from '../project/members.js';
import { projectRootOf } from '../project/role.js';
import { unformattedSpecFiles } from './documents.js';
import { runMember, runMembers } from './member-run.js';
import { applyOwnFixes } from './own-fixes.js';
import type { CheckerRegistry, Spotted } from './registry.js';
import { CHECKER_NAMESPACE, teacherOf, underTree } from './teacher.js';
import type { Teacher } from './teacher.js';

const PLUGIN_PREFIX = 'jterrazz/';

export const CHECKER_READ = 'docs/19-linting.md#the-conventions-checker';

export function directoryRefusal(path: string, what: string): null | string {
    const resolved = resolve(path);

    return existsSync(resolved) && statSync(resolved).isDirectory()
        ? null
        : refusal({
              fix: `name an existing ${what}, or run from inside one`,
              found: `no such ${what}: ${resolved}`,
              read: CHECKER_READ,
              why: 'a path that names nothing holds no spec to judge, and a run over it would read as a clean tree',
          });
}

function unformattedRefusals(root: string, specsRoots: readonly string[]): string[] {
    return specsRoots.flatMap((specsRoot) =>
        unformattedSpecFiles(specsRoot).map((rel) =>
            refusal({
                fix: "run 'jterrazz-test-check --fix' (make fix), which orders its keys and writes its streams as block scalars",
                found: `\`${relative(root, join(specsRoot, rel)) || rel}\`, a spec document out of its format`,
                read: 'docs/20-documents.md#the-schema-and-the-format',
                why: 'one key order and block-scalar streams make every document read and diff alike, and the formatter writes them',
            }),
        ),
    );
}

function pluginKeysLeft(root: string): string[] {
    return Object.keys(sectionOf(root, BASELINE_SECTION) ?? {})
        .filter((key) => key.startsWith(PLUGIN_PREFIX))
        .toSorted()
        .map(
            (key) =>
                `baseline-ratchet  ${labelOf(BASELINE_SECTION)}  ${refusal({
                    fix: "run 'typescript baseline', then 'jterrazz-test-check baseline'",
                    found: `\`${key}\` is held in the ${BASELINE_SECTION} section`,
                    read: 'docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson',
                    why: "the plugin's rules are oxlint's own, held file by file in oxlint-suppressions.json — one finding, one judge",
                })}`,
        );
}

function fixesOf(registry: CheckerRegistry, specsRoots: readonly string[]): string[] {
    return specsRoots.flatMap((specsRoot) =>
        registry.fixes.flatMap((fix) =>
            fix(specsRoot).map((line) => `conventions checker: ${line}`),
        ),
    );
}

const treeSpotted = (registry: CheckerRegistry, specsRoot: string, root: string): Spotted[] =>
    underTree(
        registry.tree.flatMap((pass) => pass(specsRoot)),
        relative(root, specsRoot),
    );

export function projectSpotted(registry: CheckerRegistry, root: string): Spotted[] {
    return [
        ...discoverSpecRoots(root).flatMap((specsRoot) => treeSpotted(registry, specsRoot, root)),
        ...runMembers(root, registry),
    ];
}

function isSpecsTree(dir: string): boolean {
    const owner = projectRootOf(dir);

    return (owner === undefined ? dir : relative(owner, dir)).split(/[/\\]/u).includes('specs');
}

type Run = { context: Context; registry: CheckerRegistry; teach: Teacher };

type Judged = {
    findings: Finding[];
    fixes?: readonly string[];
    passes: readonly string[];
    refusals?: readonly string[];
    what: string;
};

// A run over part of a project keeping the section reports, and the run over its root judges.
function judgedWhere({ context }: Run, judged: Judged, deferring: boolean): PassResult {
    const { findings, fixes = [], passes, refusals = [], what } = judged;
    const judge = process.cwd();
    const deferred = deferring && keepsSection(judge, BASELINE_SECTION);

    return {
        ...(refusals.length > 0 ? { failed: true } : {}),
        ...(deferred ? { deferred: true } : {}),
        findings,
        lines: [
            ...fixes,
            ...refusals,
            ...(deferred && findings.length > 0
                ? [
                      `conventions checker: ${String(findings.length)} finding(s) ${what}, judged by ${relative(judge, join(judge, BASELINE)) || BASELINE} › ${BASELINE_SECTION}`,
                  ]
                : []),
            ...(context.has('--verbose')
                ? [`conventions checker ${what} (${passes.join(', ')})`]
                : []),
        ],
    };
}

function memberRun(run: Run, member: string): PassResult {
    const { context, registry, teach } = run;
    const { root } = context;
    const refused = directoryRefusal(member, 'member directory');
    if (refused !== null) {
        return { failed: true, lines: [refused] };
    }
    const dir = resolve(member);
    const judged = {
        passes: registry.memberPassIds,
        what: `for member ${relative(root, dir) || '.'}`,
    };
    if (dir !== root) {
        return judgedWhere(
            run,
            { ...judged, findings: teach(runMember(dir, root, registry)) },
            true,
        );
    }
    const specsRoots = discoverSpecRoots(root);
    const fixes = context.fix ? fixesOf(registry, specsRoots) : [];
    if (context.fix) {
        applyOwnFixes(root);
    }
    const spotted = keepsSection(root, BASELINE_SECTION)
        ? projectSpotted(registry, root)
        : runMember(dir, root, registry);

    return judgedWhere(
        run,
        {
            ...judged,
            findings: teach(spotted),
            fixes,
            refusals: [...unformattedRefusals(root, specsRoots), ...pluginKeysLeft(root)],
        },
        false,
    );
}

function treeRun(run: Run, tree: string): PassResult {
    const { context, registry, teach } = run;
    const fixes = context.fix ? fixesOf(registry, [tree]) : [];

    return judgedWhere(
        run,
        {
            findings: teach(treeSpotted(registry, tree, tree)),
            fixes,
            passes: registry.treePassIds,
            refusals: unformattedRefusals(tree, [tree]),
            what: `under ${tree}`,
        },
        true,
    );
}

function projectRun(run: Run): PassResult {
    const { context, registry, teach } = run;
    const { root } = context;
    const specsRoots = discoverSpecRoots(root);
    if (context.positionals.length > 0 && specsRoots.length === 0) {
        return {
            failed: true,
            lines: [
                refusal({
                    fix: 'name a specs tree, or a project root that holds one',
                    found: `no \`specs/\` tree under ${root}`,
                    read: CHECKER_READ,
                    why: 'the checker judges specs trees, and a directory holding none would read as a clean tree',
                }),
            ],
        };
    }
    const fixes = context.fix ? fixesOf(registry, specsRoots) : [];
    if (context.fix) {
        applyOwnFixes(root);
    }

    return judgedWhere(
        run,
        {
            findings: teach(projectSpotted(registry, root)),
            fixes,
            passes: [...new Set([...registry.treePassIds, ...registry.memberPassIds])],
            refusals: [...unformattedRefusals(root, specsRoots), ...pluginKeysLeft(root)],
            what: `under ${root}`,
        },
        false,
    );
}

export function conventionsPass(registry: CheckerRegistry): Pass {
    const teach = teacherOf(registry);

    return {
        check(context) {
            const run = { context, registry, teach };
            const member = context.value('--member');
            if (member !== undefined) {
                return memberRun(run, member);
            }
            const [positional] = context.positionals;
            if (positional === undefined) {
                return projectRun(run);
            }
            const refused = directoryRefusal(positional, 'directory');
            if (refused !== null) {
                return { failed: true, lines: [refused] };
            }

            return isSpecsTree(context.root) ? treeRun(run, context.root) : projectRun(run);
        },
        namespace: CHECKER_NAMESPACE,
        valued: ['--member'],
    };
}
