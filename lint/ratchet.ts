import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The ratchet this package owns: a count per rule that may fall and never rise.
 *
 * `test.baseline.json`, at the project root, records `{ "<rule>": count }` for
 * the two rulebooks `@jterrazz/test` ships — its oxlint plugin's rules under
 * `jterrazz/<rule>` and its checker's findings under `jterrazz-check/<code>`.
 * `@jterrazz/typescript` records everything else in its own file and sets these
 * two namespaces aside, so each finding has one file and one judge.
 *
 * Three things break the ratchet: a rule above its entry (the debt grew), a
 * rule with findings and no entry (new debt), an entry whose rule is at zero
 * (the debt was paid — the entry goes). Severity is not read: a warning is
 * exactly the debt a ratchet exists to hold down.
 */

/** The file, at the project root. */
export const TEST_BASELINE = 'test.baseline.json';

/** The namespace the checker's findings take — its published `jterrazz-check(<code>)`. */
export const CHECKER_NAMESPACE = 'jterrazz-check';

/** The plugin whose oxlint diagnostics this package owns. */
const PLUGIN = 'jterrazz';

/** One oxlint diagnostic of this package's plugin, as its JSON report carries it. */
export type PluginDiagnostic = {
    code: string;
    column: number;
    file: string;
    line: number;
    message: string;
    severity: 'error' | 'warn';
};

/** `jterrazz(i2-sibling-test-naming)` → `jterrazz/i2-sibling-test-naming`. */
export function keyOf(code: string): string {
    const match = /^(?<plugin>[\w-]+)\((?<rule>[^)]+)\)$/u.exec(code);
    return match?.groups === undefined ? code : `${match.groups.plugin}/${match.groups.rule}`;
}

/** How many findings each key accounts for. */
export function countsOf(codes: readonly string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const code of codes) {
        const key = keyOf(code);
        counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
}

/** Every way the counts break the recorded ratchet, sorted the way a reader scans them. */
export function judge(
    counts: Readonly<Record<string, number>>,
    baseline: Readonly<Record<string, number>>,
): string[] {
    const broken: string[] = [];
    for (const [key, count] of Object.entries(counts).toSorted(([a], [b]) => (a < b ? -1 : 1))) {
        const allowed = baseline[key];
        if (allowed === undefined) {
            broken.push(`${key} has ${count} finding(s) and no entry — it is new debt`);
        } else if (count > allowed) {
            broken.push(`${key} is at ${count}, above its baseline of ${allowed}`);
        }
    }
    for (const key of Object.keys(baseline).toSorted()) {
        if ((counts[key] ?? 0) === 0) {
            broken.push(`${key} is at zero — the ratchet moved, delete its entry`);
        }
    }
    return broken;
}

/** Does the project at `root` keep a ratchet? */
export function keepsBaseline(root: string): boolean {
    return existsSync(join(root, TEST_BASELINE));
}

/** The recorded counts at `root`; an unreadable file records nothing. */
export function readBaseline(root: string): Record<string, number> {
    try {
        const parsed: unknown = JSON.parse(readFileSync(join(root, TEST_BASELINE), 'utf8'));
        return typeof parsed === 'object' && parsed !== null
            ? Object.fromEntries(
                  Object.entries(parsed).filter(
                      (entry): entry is [string, number] => typeof entry[1] === 'number',
                  ),
              )
            : {};
    } catch {
        return {};
    }
}

/** Record the counts at `root`, sorted, so a diff reads as a burn-down. */
export function writeBaseline(root: string, counts: Readonly<Record<string, number>>): void {
    const sorted = Object.fromEntries(
        Object.entries(counts).toSorted(([a], [b]) => (a < b ? -1 : 1)),
    );
    writeFileSync(join(root, TEST_BASELINE), `${JSON.stringify(sorted, null, 4)}\n`);
}

/**
 * The project's own oxlint: the binary its root installs. Never one found
 * above the root — a fixture project inside another repository would be
 * linted with that repository's config.
 */
function oxlintOf(root: string): string | undefined {
    const candidate = join(root, 'node_modules', '.bin', 'oxlint');
    return existsSync(candidate) ? candidate : undefined;
}

/** The slice of oxlint's JSON report this pass reads. */
type OxlintReport = {
    diagnostics?: {
        code?: string;
        filename?: string;
        labels?: { span?: { column?: number; line?: number } }[];
        message?: string;
        severity?: string;
    }[];
};

/** The `jterrazz(*)` diagnostics of one oxlint JSON report; `source` names where it came from. */
function diagnosticsIn(json: string, source: string): PluginDiagnostic[] {
    let report: OxlintReport;
    try {
        report = JSON.parse(json) as OxlintReport;
    } catch {
        throw new Error(`the checker read ${source} for the ratchet and it holds no JSON report`);
    }
    return (report.diagnostics ?? [])
        .filter((diagnostic) => (diagnostic.code ?? '').startsWith(`${PLUGIN}(`))
        .map((diagnostic) => {
            const span = diagnostic.labels?.[0]?.span;
            return {
                code: diagnostic.code ?? '',
                column: span?.column ?? 1,
                file: diagnostic.filename ?? '',
                line: span?.line ?? 1,
                message: diagnostic.message ?? '',
                severity: diagnostic.severity === 'error' ? 'error' : 'warn',
            };
        });
}

/**
 * The diagnostics of THIS package's oxlint plugin over the project at `root`:
 * the toolchain sets them aside, so they are judged here or nowhere.
 *
 * With `report`, the path of the JSON report `typescript check` already wrote
 * (`--oxlint-report`), they are read from it: one oxlint run per check.
 * Without it, the checker runs the project's own oxlint, with the project's
 * own config, and no `--type-aware` — the plugin's rules read the syntax tree
 * and the disk, never a type. A project with no oxlint installed has none to
 * report.
 */
export function pluginDiagnostics(root: string, report?: string): PluginDiagnostic[] {
    if (report !== undefined) {
        return diagnosticsIn(readFileSync(report, 'utf8'), report);
    }
    const oxlint = oxlintOf(root);
    if (oxlint === undefined) {
        return [];
    }
    const run = spawnSync(oxlint, ['--format', 'json'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
    });
    try {
        return diagnosticsIn(run.stdout, oxlint);
    } catch {
        throw new Error(
            `the checker ran ${oxlint} for the ratchet and it wrote no JSON report:\n${run.stderr}`,
        );
    }
}
