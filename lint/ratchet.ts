import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The ratchet this package owns: a count per rule that may fall and never rise.
 *
 * The family keeps ONE ratchet file at the project root, `jterrazz.baseline.json`,
 * with a section per package: `{ "typescript": {...}, "test": {...} }`. This
 * package owns the `test` section — `{ "<rule>": count }` for the two
 * rulebooks it ships, its oxlint plugin's rules under `jterrazz/<rule>` and
 * its checker's findings under `jterrazz-check/<code>` — and reads, judges and
 * writes that section alone: every other section is another package's, kept
 * byte for byte when this one is recorded.
 *
 * Three things break the ratchet: a rule above its entry (the debt grew), a
 * rule with findings and no entry (new debt), an entry whose rule is at zero
 * (the debt was paid — the entry goes). Severity is not read: a warning is
 * exactly the debt a ratchet exists to hold down.
 */

/** The family's ratchet file, at the project root. */
export const BASELINE_FILE = 'jterrazz.baseline.json';

/** This package's section of it. */
export const BASELINE_SECTION = 'test';

/** The section as a line a reader sees names it. */
export const BASELINE_LABEL = `${BASELINE_FILE} › ${BASELINE_SECTION}`;

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

/** Is this parsed JSON an object of named members? */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The file's top-level object, `undefined` when it is absent, `null` when it holds no JSON object. */
function sectionsAt(root: string): null | Record<string, unknown> | undefined {
    const path = join(root, BASELINE_FILE);
    if (!existsSync(path)) {
        return undefined;
    }
    try {
        const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
        return isRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * Does the project at `root` keep this package's ratchet? A file holding a
 * `test` section does, and so does one that is no JSON object: its counts are
 * unreadable, so every finding reads as new debt rather than passing.
 */
export function keepsBaseline(root: string): boolean {
    const sections = sectionsAt(root);
    return sections === null || (sections !== undefined && BASELINE_SECTION in sections);
}

/** The recorded counts of the `test` section at `root`; an unreadable file records nothing. */
export function readBaseline(root: string): Record<string, number> {
    const section = sectionsAt(root)?.[BASELINE_SECTION];
    return typeof section === 'object' && section !== null
        ? Object.fromEntries(
              Object.entries(section).filter(
                  (entry): entry is [string, number] => typeof entry[1] === 'number',
              ),
          )
        : {};
}

/** Where one top-level member's value sits in the file's text. */
type MemberSpan = { key: string; valueEnd: number; valueStart: number };

/** The end of the string literal opening at `start` (its closing quote, exclusive). */
function stringEnd(text: string, start: number): number {
    let index = start + 1;
    while (index < text.length && text[index] !== '"') {
        index += text[index] === '\\' ? 2 : 1;
    }
    return index + 1;
}

/** The end of the JSON value opening at `start`: the first `,` or `}` outside it. */
function valueEnd(text: string, start: number): number {
    let depth = 0;
    let index = start;
    while (index < text.length) {
        const char = text[index] ?? '';
        if (char === '"') {
            index = stringEnd(text, index);
            continue;
        }
        if (char === '{' || char === '[') {
            depth += 1;
        } else if (char === '}' || char === ']') {
            if (depth === 0) {
                break;
            }
            depth -= 1;
        } else if (char === ',' && depth === 0) {
            break;
        }
        index += 1;
    }
    return text.slice(0, index).trimEnd().length;
}

/** Every top-level member of the object `text` holds — `text` is known to parse. */
function membersOf(text: string): MemberSpan[] {
    const members: MemberSpan[] = [];
    let index = text.indexOf('{') + 1;
    for (;;) {
        const keyStart = text.indexOf('"', index);
        const close = text.indexOf('}', index);
        if (keyStart === -1 || (close !== -1 && close < keyStart)) {
            return members;
        }
        const keyEnd = stringEnd(text, keyStart);
        const key = String(JSON.parse(text.slice(keyStart, keyEnd)));
        const colon = text.indexOf(':', keyEnd);
        const start =
            colon + 1 + (text.slice(colon + 1).length - text.slice(colon + 1).trimStart().length);
        const end = valueEnd(text, start);
        members.push({ key, valueEnd: end, valueStart: start });
        const next = text.indexOf(',', end);
        const closing = text.indexOf('}', end);
        if (next === -1 || (closing !== -1 && closing < next)) {
            return members;
        }
        index = next + 1;
    }
}

/**
 * Record the counts as the `test` section at `root`, sorted, so a diff reads
 * as a burn-down. Every other section keeps its bytes: the new section replaces
 * the old one's value where it stood, or closes the object where there was none.
 */
export function writeBaseline(root: string, counts: Readonly<Record<string, number>>): void {
    const sorted = Object.fromEntries(
        Object.entries(counts).toSorted(([a], [b]) => (a < b ? -1 : 1)),
    );
    const section = JSON.stringify(sorted, null, 4).replaceAll('\n', '\n    ');
    const path = join(root, BASELINE_FILE);
    const fresh = `{\n    "${BASELINE_SECTION}": ${section}\n}\n`;
    const sections = sectionsAt(root);
    if (sections === undefined) {
        writeFileSync(path, fresh);
        return;
    }
    if (sections === null) {
        throw new Error(
            `${BASELINE_FILE} holds no JSON object — mend it before recording, or its other sections would be lost`,
        );
    }
    const text = readFileSync(path, 'utf8');
    const members = membersOf(text);
    const own = members.find((member) => member.key === BASELINE_SECTION);
    const last = members.at(-1);
    if (own !== undefined) {
        writeFileSync(
            path,
            `${text.slice(0, own.valueStart)}${section}${text.slice(own.valueEnd)}`,
        );
    } else if (last === undefined) {
        writeFileSync(path, fresh);
    } else {
        writeFileSync(
            path,
            `${text.slice(0, last.valueEnd)},\n    "${BASELINE_SECTION}": ${section}${text.slice(last.valueEnd)}`,
        );
    }
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
