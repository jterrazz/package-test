import type { AfterHook, BeforeHook, Context, RuleDocs, RuleMeta } from '@oxlint/plugins';

import type { RuleDoc } from '../catalogue/row.js';
import type { AstNode } from '../reading/ast.js';

export type Visitor = Record<string, (node: AstNode) => void> & {
    after?: AfterHook;
    before?: BeforeHook;
};

/** `before` opens each file and returns `false` to skip it; the context answers only inside the hooks and handlers. */
export type LintRule = {
    createOnce: (context: Context) => Visitor;
    meta: RuleMeta & { docs: RuleDoc & RuleDocs };
};

export type LintPlugin = {
    meta: { name: string };
    rules: Record<string, LintRule>;
};
