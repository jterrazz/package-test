import { judgeFloor, raisedFloor, sectionOf, writeSection } from '@jterrazz/typescript/rules';
import type { Broken, Counts } from '@jterrazz/typescript/rules';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { COVERAGE_DIR } from '../project/artifacts.js';

export type CoverageMetrics = {
    branches: number;
    functions: number;
    lines: number;
    statements: number;
};

export type CoverageBaseline = Record<string, CoverageMetrics>;

export const COVERAGE_SECTION = 'test.coverage';

export const SUMMARY_FILE = `${COVERAGE_DIR}/coverage-summary.json`;

const METRICS = ['statements', 'branches', 'functions', 'lines'] as const;

/** Rounded as the section records it, two decimals. */
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

/** One key per scope and metric, `all/branches`: a section of the baseline holds counts alone. */
export function flattened(scope: string, metrics: CoverageMetrics): Counts {
    return Object.fromEntries(METRICS.map((metric) => [`${scope}/${metric}`, metrics[metric]]));
}

/** A scope missing a metric is refused, never read as zero: a floor of 0 forbids nothing. */
export function readFloors(root: string): CoverageBaseline {
    const section = sectionOf(root, COVERAGE_SECTION) ?? {};
    const scopes = new Set(Object.keys(section).map((key) => key.slice(0, key.lastIndexOf('/'))));
    const floors: CoverageBaseline = {};
    for (const scope of scopes) {
        const missing = METRICS.filter((metric) => section[`${scope}/${metric}`] === undefined);
        if (missing.length > 0) {
            throw new Error(
                `jterrazz.baseline.json › ${COVERAGE_SECTION}: the \`${scope}\` floor has no ${missing.join(', ')} — ` +
                    'a missing metric is a floor of zero, which forbids nothing. Run `npm run coverage`.',
            );
        }
        floors[scope] = {
            branches: percent(section[`${scope}/branches`]),
            functions: percent(section[`${scope}/functions`]),
            lines: percent(section[`${scope}/lines`]),
            statements: percent(section[`${scope}/statements`]),
        };
    }
    return floors;
}

export function drops(
    floor: CoverageMetrics | undefined,
    now: CoverageMetrics,
    scope: string,
): Broken[] {
    return floor === undefined ? [] : judgeFloor(flattened(scope, now), flattened(scope, floor));
}

export function raised(floor: CoverageMetrics | undefined, now: CoverageMetrics): CoverageMetrics {
    const next = raisedFloor(flattened('', now), flattened('', floor ?? now));
    return {
        branches: next['/branches'] ?? now.branches,
        functions: next['/functions'] ?? now.functions,
        lines: next['/lines'] ?? now.lines,
        statements: next['/statements'] ?? now.statements,
    };
}

export function writeFloors(root: string, floors: CoverageBaseline): void {
    const section: Counts = {};
    for (const [scope, metrics] of Object.entries(floors)) {
        Object.assign(section, flattened(scope, metrics));
    }
    writeSection(root, COVERAGE_SECTION, section);
}

export function report(scope: string, metrics: CoverageMetrics): string {
    return `${scope}: ${METRICS.map((metric) => `${metric} ${metrics[metric].toFixed(2)}%`).join(', ')}`;
}
