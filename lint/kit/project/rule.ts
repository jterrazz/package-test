import type { DefinedRule } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import type { Row } from '../catalogue/row.js';
import type { Visitor } from './ast.js';

/** `before` opens each file and returns `false` to skip it; the context answers only inside the hooks and handlers. */
export type PluginRule = DefinedRule<Row, { createOnce: (context: Context) => Visitor }>;

export type LintPlugin = {
    meta: { name: string };
    rules: Record<string, PluginRule>;
};
