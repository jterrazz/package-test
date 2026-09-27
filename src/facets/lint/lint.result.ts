import { BaseResult } from '../../expectations/result.js';
import type { BaseResultOptions } from '../../expectations/result.js';
import { TextAccessor } from '../../expectations/text/text.js';
import type { MatrixRow } from '../../kernel/chain/capability.js';

export const LINT_RESULT_ROWS: readonly MatrixRow[] = [
    { group: 'Result accessor', name: '.report', probe: 'result.report' },
    { group: 'Result accessor', member: 'file', name: '.file()', probe: '.file(' },
    { group: 'Result accessor', member: 'directory', name: '.directory()', probe: '.directory(' },
];

/** What `.run()` hands back: the report of every linter, and the tree it linted. */
export class LintResult extends BaseResult {
    private readonly text: string;

    constructor(options: BaseResultOptions & { report: string }) {
        super(options);
        this.text = options.report;
    }

    /** Each diagnostic as `<file>:<line>:<column>  <plugin>(<rule>)`, then its message a part per line, in the order a reader walks the tree; a clean tree is the empty text. */
    get report(): TextAccessor {
        return new TextAccessor(this.text, 'report', this.testDir, { captures: this.captures });
    }
}
