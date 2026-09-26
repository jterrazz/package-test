import type { Context, RuleDocs, RuleMeta } from '@oxlint/plugins';

import type { RowDocs } from '../catalogue/row.js';
import type { Visitor } from '../reading/ast.js';

/** `before` opens each file and returns `false` to skip it; the context answers only inside the hooks and handlers. */
export type LintRule = {
    createOnce: (context: Context) => Visitor;
    meta: RuleMeta & { docs: RowDocs & RuleDocs };
};

export type LintPlugin = {
    meta: { name: string };
    rules: Record<string, LintRule>;
};
