import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CHECKER_PASSES, STATIC_RULES } from '../../consumer/catalogue/manifest.js';
import { CHECKER_PASS_IDS as CHECKER_PASS_REGISTRY } from '../../consumer/checks/checker.js';
import plugin from '../../index.oxlint.js';
import { SELF_CHECKER_PASSES, SELF_STATIC_RULES } from '../catalogue/manifest.js';
import { SELF_CHECKER_PASS_IDS } from '../checks/checker.js';
import selfPlugin from '../rules/plugin.js';

export const ROOT = resolve(import.meta.dirname, '../../..');

export const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

export const allRules = { ...plugin.rules, ...selfPlugin.rules };

export function ruleFileOf(entry: { audience: string; family: string; name: string }): string {
    const rules = entry.audience === 'self' ? 'lint/self/rules' : 'lint/consumer/rules';
    return `${rules}/${entry.family}/${entry.name}.ts`;
}

export const STATIC_ROWS = [...STATIC_RULES, ...SELF_STATIC_RULES];

export function staticRowsOf(audience: string): string[] {
    return STATIC_ROWS.filter((row) => row.audience === audience)
        .map((row) => row.name)
        .toSorted();
}

export const CHECKER_PASS_IDS = new Set<string>(CHECKER_PASS_REGISTRY);

export const SELF_PASSES = new Set<string>(SELF_CHECKER_PASS_IDS);

export function audiences(rows: { audience: string }[]): string[] {
    return [...new Set(rows.map((row) => row.audience))];
}

export function checkerRowsOf(audience: string): string[] {
    return [...CHECKER_PASSES, ...SELF_CHECKER_PASSES]
        .filter((entry) => entry.audience === audience)
        .map((entry) => entry.name)
        .toSorted();
}

/** Whole words only: `qui` is inside "required", `est` inside "test". */
export function carries(text: string, token: string): boolean {
    return new RegExp(String.raw`(?<![\p{L}'’])${token}(?![\p{L}'’])`, 'u').test(
        text.toLowerCase(),
    );
}
