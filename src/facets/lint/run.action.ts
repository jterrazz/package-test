import { defineAction } from '../../chain/action.js';
import type { ChainSignature } from '../../chain/capability.js';
import { scratchDirectory } from '../../chain/paths/scratch.js';
import { lintReport } from './lint-report.js';
import type { LintPort } from './lint.port.js';
import { LINT_RESULT_ROWS, LintResult } from './lint.result.js';
import { rules } from './rules.capability.js';

export type LintRunOptions = {
    /** Handed to every checker before the tree, as a checker takes a flag (`--member packages/web`). */
    args?: string;
    /** Apply the linters' fixes, then lint the fixed tree: the report is what a run after the fix says. */
    fix?: boolean;
};

export type RunSignature = ChainSignature & {
    readonly chain: {
        /** Lint the working directory with every linter the specification names. */
        run: (options?: LintRunOptions) => Promise<LintResult>;
    };
};

export const run = defineAction<
    'run',
    [options?: LintRunOptions],
    LintResult,
    RunSignature,
    { linters: LintPort }
>({
    accessors: LINT_RESULT_ROWS,
    name: 'run',
    perform: async ([options], read, { linters }, { config, testDir, workDir }) => {
        const tree = workDir ?? testDir;
        const diagnostics = await linters.lint(tree, {
            args: options?.args ?? '',
            fix: options?.fix ?? false,
            rules: read(rules),
        });
        return new LintResult({ config, report: lintReport(diagnostics), testDir, workDir: tree });
    },
    prepare: () => ({ workDir: scratchDirectory('spec-lint-') }),
    row: { group: 'Terminal action', name: '.run()', probe: '.run(' },
});
