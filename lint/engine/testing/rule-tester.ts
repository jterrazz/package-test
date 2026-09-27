/* oxlint-disable vitest/expect-expect, vitest/valid-describe-callback, vitest/valid-title -- this module declares no suite of its own: it hands the runner's primitives to oxlint's RuleTester, which declares one per rule and a test per case, so the titles and the assertions are the tester's */
import { refusalBlock } from '@jterrazz/typescript/rules';
import { createRequire } from 'node:module';
import type { RuleTester } from 'oxlint/plugins-dev';
import { it as declareCase, describe as declareSuite } from 'vitest';

type Tester = typeof RuleTester;

/** `column` is 0-based, as oxlint's RuleTester reads it; the report a lint spec compares prints it 1-based, as the compiler does. */
type PositionedError = RuleTester.Error & { column: number; line: number };

/** oxlint's test cases, each invalid one stating where every error it expects is reported. */
export type PositionedCases = {
    invalid: (Omit<RuleTester.InvalidTestCase, 'errors'> & { errors: PositionedError[] })[];
    valid: RuleTester.TestCases['valid'];
};

export type PositionedRuleTester = {
    run: (name: string, rule: object, cases: PositionedCases) => void;
};

const isPositioned = (entry: unknown): boolean =>
    typeof entry === 'object' &&
    entry !== null &&
    'line' in entry &&
    typeof entry.line === 'number' &&
    'column' in entry &&
    typeof entry.column === 'number';

function unplacedOf(errors: unknown): null | string {
    if (!Array.isArray(errors)) {
        return 'whose errors are a count';
    }
    if (errors.length === 0) {
        return 'which states no error';
    }
    const unplaced = errors.findIndex((entry) => !isPositioned(entry));
    return unplaced === -1 ? null : `whose error ${String(unplaced)} states no line and column`;
}

function refuseUnpositioned(name: string, cases: PositionedCases): void {
    for (const [index, invalid] of cases.invalid.entries()) {
        const unplaced = unplacedOf(invalid.errors);
        if (unplaced !== null) {
            throw new Error(
                refusalBlock({
                    fix: 'state each error as an object carrying its `line` and `column`',
                    found: `${name}: invalid case ${String(index)}, ${unplaced}`,
                    read: 'docs/21-lint.md#a-rule-alone-ruletester',
                    why: 'A rule proves where it reports, not only that it did: an error with no position passes for a report on any node.',
                }),
            );
        }
    }
}

function loadedTester(): Tester {
    const plugins: unknown = createRequire(import.meta.url)('oxlint/plugins-dev');
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the optional peer is loaded on first use, so the module arrives untyped: its declaration file is the one its types are read from
    return (plugins as { RuleTester: Tester }).RuleTester;
}

/** oxlint's `RuleTester`, declaring its suites and cases with vitest, refusing an invalid case that does not state where each error is reported. */
export function ruleTester(config?: RuleTester.Config): PositionedRuleTester {
    const Loaded = loadedTester();
    Loaded.describe = (name, body) => {
        declareSuite(name, body);
    };
    Loaded.it = (name, body) => {
        declareCase(name, body);
    };
    const tester = new Loaded(config);
    return {
        run: (name, rule, cases) => {
            refuseUnpositioned(name, cases);
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a rule declares the few AST fields it reads, so it is typed against oxlint's nodes by its caller alone
            tester.run(name, rule as Parameters<RuleTester['run']>[1], cases);
        },
    };
}
