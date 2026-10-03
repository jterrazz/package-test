import { defineCheck, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { DefinedCheck, Finding } from '@jterrazz/typescript/rules';

import type { Row } from '../catalogue/row.js';
import type { CheckerRegistry, Spotted } from './registry.js';

export const CHECKER_NAMESPACE = 'jterrazz-check';

export type Teacher = (spotted: readonly Spotted[]) => Finding[];

export function teacherOf({ chapter, rows }: Pick<CheckerRegistry, 'chapter' | 'rows'>): Teacher {
    const checks = new Map<string, DefinedCheck<Row>>();
    // Stryker disable ConditionalExpression,BlockStatement,CallExpression: a cache: a check defined again from its row answers the same
    const checkOf = (rule: string): DefinedCheck<Row> => {
        const known = checks.get(rule);
        if (known !== undefined) {
            return known;
        }
        const row = rowNamed(rows, rule);
        const check = defineCheck({
            docs: row,
            namespace: CHECKER_NAMESPACE,
            read: readAt(row, chapter),
        });
        checks.set(rule, check);

        return check;
    };
    // Stryker restore ConditionalExpression,BlockStatement,CallExpression

    return (spotted) =>
        spotted.map(({ column, fix, found, line, path, rule }) =>
            checkOf(rule).finding({ column: column ?? 1, line, path }, { fix, found }),
        );
}

export function underTree(spotted: Spotted[], prefix: string): Spotted[] {
    if (prefix !== '') {
        for (const one of spotted) {
            one.path = `${prefix}/${one.path}`;
        }
    }

    return spotted;
}
