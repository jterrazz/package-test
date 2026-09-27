import type { Diagnostic } from './lint-report.js';

export type LintRules = Readonly<Record<string, unknown>>;

export type LintRun = { args: string; fix: boolean; rules: LintRules };

export type LintPort = {
    /** Every diagnostic of every linter the specification names, over the tree at `tree`. */
    readonly lint: (tree: string, run: LintRun) => Promise<Diagnostic[]>;
};
