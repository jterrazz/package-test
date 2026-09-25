import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { COVERAGE_DIR } from '../src/kernel/files/artifacts.js';

/** A floor that only ever rises: lowering it is an edit to a committed file, with a commit saying why. */

export type CoverageMetrics = {
    branches: number;
    functions: number;
    lines: number;
    statements: number;
};

export type CoverageBaseline = Record<string, CoverageMetrics>;

export const BASELINE_FILE = 'coverage.baseline.json';

export const SUMMARY_FILE = `${COVERAGE_DIR}/coverage-summary.json`;

const METRICS = ['statements', 'branches', 'functions', 'lines'] as const;

/** Rounded as the file records it, two decimals. */
function percent(value: unknown): number {
    return typeof value === 'number' ? Math.round(value * 100) / 100 : 0;
}

/** `null` when no report exists: the CLI says "run it first" rather than pass on a file nobody wrote. */
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

/** A scope missing a metric is refused, never read as zero: a floor of 0 forbids nothing. */
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
        if (typeof entry !== 'object' || entry === null) {
            throw new Error(`${BASELINE_FILE}: the \`${scope}\` floor is not an object.`);
        }
        const missing = METRICS.filter((metric) => typeof Reflect.get(entry, metric) !== 'number');
        if (missing.length > 0) {
            throw new Error(
                `${BASELINE_FILE}: the \`${scope}\` floor has no ${missing.join(', ')} — ` +
                    'a missing metric is a floor of zero, which forbids nothing. Run `npm run coverage`.',
            );
        }
        baseline[scope] = {
            branches: percent(Reflect.get(entry, 'branches')),
            functions: percent(Reflect.get(entry, 'functions')),
            lines: percent(Reflect.get(entry, 'lines')),
            statements: percent(Reflect.get(entry, 'statements')),
        };
    }
    return baseline;
}

export function drops(floor: CoverageMetrics | undefined, now: CoverageMetrics): string[] {
    if (floor === undefined) {
        return [];
    }
    return METRICS.filter((metric) => now[metric] < floor[metric]).map(
        (metric) =>
            `${metric} fell to ${now[metric].toFixed(2)}% — the floor is ${floor[metric].toFixed(2)}%`,
    );
}

export function raised(floor: CoverageMetrics | undefined, now: CoverageMetrics): CoverageMetrics {
    return {
        branches: Math.max(floor?.branches ?? 0, now.branches),
        functions: Math.max(floor?.functions ?? 0, now.functions),
        lines: Math.max(floor?.lines ?? 0, now.lines),
        statements: Math.max(floor?.statements ?? 0, now.statements),
    };
}

/** Sorted, with a trailing newline: the formatter's shape. */
export function writeBaseline(root: string, baseline: CoverageBaseline): void {
    const sorted = Object.fromEntries(
        Object.keys(baseline)
            .toSorted()
            .map((key) => [key, baseline[key]]),
    );
    writeFileSync(resolve(root, BASELINE_FILE), `${JSON.stringify(sorted, null, 4)}\n`);
}

export function report(scope: string, metrics: CoverageMetrics): string {
    return `${scope}: ${METRICS.map((metric) => `${metric} ${metrics[metric].toFixed(2)}%`).join(', ')}`;
}
