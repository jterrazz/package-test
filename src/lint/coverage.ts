import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { COVERAGE_DIR } from '../core/artifacts/artifacts.js';

/**
 * The coverage ratchet — a floor that only ever rises.
 *
 * A fixed threshold is a number somebody picked: set it where the project
 * stands and it forbids nothing; set it where the project should be and every
 * run is red until it gets there, which is how a gate becomes something people
 * pass with `--no-verify`. A ratchet asks the one question a gate can answer
 * honestly: is this change worse than the last one?
 *
 * So `npm run coverage` records where the suite actually stands, and
 * `npm run coverage:check` refuses a drop. The recorded number never goes down
 * by itself — lowering it is an edit to a committed file, with a commit body
 * saying why, which is the conversation the gate exists to force.
 *
 * The numbers come from v8's `json-summary` report, which the preset turns on
 * with the other two reporters: `text` for the person running it and `html`
 * for the one chasing a line.
 */

/** The four things v8 counts. */
export type CoverageMetrics = {
    branches: number;
    functions: number;
    lines: number;
    statements: number;
};

/** The recorded floor, per run scope (`all`, or one project's name). */
export type CoverageBaseline = Record<string, CoverageMetrics>;

/** Where the ratchet is committed. */
export const BASELINE_FILE = 'coverage.baseline.json';

/** Where v8 writes the report this module reads. */
export const SUMMARY_FILE = `${COVERAGE_DIR}/coverage-summary.json`;

/** The metric names, in the order every message prints them. */
const METRICS = ['statements', 'branches', 'functions', 'lines'] as const;

/** One percentage, rounded the way the file records it (two decimals). */
function percent(value: unknown): number {
    return typeof value === 'number' ? Math.round(value * 100) / 100 : 0;
}

/**
 * The totals of the last `--coverage` run.
 *
 * Returns `null` when no report is there: the CLI says "run it first" rather
 * than passing a gate on a file nobody wrote.
 */
export function readSummary(root: string): CoverageMetrics | null {
    const path = resolve(root, SUMMARY_FILE);
    if (!existsSync(path)) {
        return null;
    }
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const total =
        typeof parsed === 'object' && parsed !== null && 'total' in parsed ? parsed.total : {};
    const pct = (metric: string): number => {
        if (typeof total !== 'object' || total === null || !(metric in total)) {
            return 0;
        }
        const entry: unknown = Reflect.get(total, metric);
        return percent(
            typeof entry === 'object' && entry !== null && 'pct' in entry ? entry.pct : 0,
        );
    };
    return {
        branches: pct('branches'),
        functions: pct('functions'),
        lines: pct('lines'),
        statements: pct('statements'),
    };
}

/** The committed floor, or an empty one the first time. */
export function readBaseline(root: string): CoverageBaseline {
    const path = resolve(root, BASELINE_FILE);
    if (!existsSync(path)) {
        return {};
    }
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) {
        return {};
    }
    const baseline: CoverageBaseline = {};
    for (const scope of Object.keys(parsed)) {
        const entry: unknown = Reflect.get(parsed, scope);
        if (typeof entry === 'object' && entry !== null) {
            baseline[scope] = {
                branches: percent(Reflect.get(entry, 'branches')),
                functions: percent(Reflect.get(entry, 'functions')),
                lines: percent(Reflect.get(entry, 'lines')),
                statements: percent(Reflect.get(entry, 'statements')),
            };
        }
    }
    return baseline;
}

/** Every metric that fell below its floor, as one line each. */
export function drops(floor: CoverageMetrics | undefined, now: CoverageMetrics): string[] {
    if (floor === undefined) {
        return [];
    }
    return METRICS.filter((metric) => now[metric] < floor[metric]).map(
        (metric) =>
            `${metric} fell to ${now[metric].toFixed(2)}% — the floor is ${floor[metric].toFixed(2)}%`,
    );
}

/** The floor after a run: each metric the higher of the two. */
export function raised(floor: CoverageMetrics | undefined, now: CoverageMetrics): CoverageMetrics {
    return {
        branches: Math.max(floor?.branches ?? 0, now.branches),
        functions: Math.max(floor?.functions ?? 0, now.functions),
        lines: Math.max(floor?.lines ?? 0, now.lines),
        statements: Math.max(floor?.statements ?? 0, now.statements),
    };
}

/** Write the ratchet back, sorted, with a trailing newline (the formatter's shape). */
export function writeBaseline(root: string, baseline: CoverageBaseline): void {
    const sorted = Object.fromEntries(
        Object.keys(baseline)
            .toSorted()
            .map((key) => [key, baseline[key]]),
    );
    writeFileSync(resolve(root, BASELINE_FILE), `${JSON.stringify(sorted, null, 4)}\n`);
}

/** One line per metric, for the human reading the gate's output. */
export function report(scope: string, metrics: CoverageMetrics): string {
    return `${scope}: ${METRICS.map((metric) => `${metric} ${metrics[metric].toFixed(2)}%`).join(', ')}`;
}
