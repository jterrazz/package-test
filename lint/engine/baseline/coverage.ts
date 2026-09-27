import {
    BASELINE,
    judgeFloor,
    labelOf,
    raisedFloor,
    readBaseline,
    refusal,
    writeSection,
} from '@jterrazz/typescript/rules';
import type { Broken, Counts } from '@jterrazz/typescript/rules';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { COVERAGE_DIR } from '../project/artifacts.js';

export const COVERAGE_SECTION = 'test.coverage';

export const COVERAGE_READ = 'docs/03-testing.md#coverage-is-a-ratchet-not-a-threshold';

export const SUMMARY_FILE = `${COVERAGE_DIR}/coverage-summary.json`;

const METRICS = ['statements', 'branches', 'functions', 'lines'] as const;

const percent = (value: unknown): number =>
    typeof value === 'number' ? Math.round(value * 100) / 100 : 0;

const fieldOf = (value: unknown, key: string): unknown =>
    typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;

export function readSummary(root: string, scope: string): Counts | null {
    const path = resolve(root, SUMMARY_FILE);
    if (!existsSync(path)) {
        return null;
    }
    const total = fieldOf(JSON.parse(readFileSync(path, 'utf8')), 'total');

    return Object.fromEntries(
        METRICS.map((metric) => [
            `${scope}/${metric}`,
            percent(fieldOf(fieldOf(total, metric), 'pct')),
        ]),
    );
}

export type Floor = { floor: Counts; problem: null | string };

const floorRefusal = (found: string, fix: string): string =>
    refusal({
        fix,
        found,
        read: COVERAGE_READ,
        why: 'the floor is what the suite reached, and a floor read wrong forbids nothing',
    });

export function readFloor(root: string): Floor {
    const { problem, sections } = readBaseline(root);
    if (problem !== null) {
        return {
            floor: {},
            problem: floorRefusal(
                `${BASELINE} ${problem}`,
                `correct ${BASELINE} until it is one JSON object of sections, then run again`,
            ),
        };
    }
    const floor = sections?.[COVERAGE_SECTION] ?? {};
    const unscoped = Object.keys(floor).filter((key) => !key.includes('/'));
    if (unscoped.length > 0) {
        return {
            floor: {},
            problem: floorRefusal(
                `${labelOf(COVERAGE_SECTION)} keys ${unscoped.map((key) => `\`${key}\``).join(', ')} to no scope`,
                'write each key as `<scope>/<metric>`, or run `npm run coverage` to record the floor again',
            ),
        };
    }
    for (const scope of new Set(
        Object.keys(floor).map((key) => key.slice(0, key.lastIndexOf('/'))),
    )) {
        const missing = METRICS.filter((metric) => floor[`${scope}/${metric}`] === undefined);
        if (missing.length > 0) {
            return {
                floor: {},
                problem: floorRefusal(
                    `${labelOf(COVERAGE_SECTION)}: the \`${scope}\` floor has no ${missing.join(', ')}`,
                    'run `npm run coverage` to record the whole floor',
                ),
            };
        }
    }

    return { floor, problem: null };
}

export const scopeOf = (floor: Counts, scope: string): Counts =>
    Object.fromEntries(Object.entries(floor).filter(([key]) => key.startsWith(`${scope}/`)));

export const drops = (floor: Counts, now: Counts): Broken[] => judgeFloor(now, floor);

export function recordFloor(root: string, floor: Counts, now: Counts): Counts {
    const next = raisedFloor(now, floor);
    writeSection(root, COVERAGE_SECTION, next);

    return next;
}

export function report(scope: string, measures: Counts): string {
    return `${scope}: ${METRICS.map((metric) => `${metric} ${(measures[`${scope}/${metric}`] ?? 0).toFixed(2)}%`).join(', ')}`;
}
