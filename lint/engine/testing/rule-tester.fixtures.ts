/* oxlint-disable vitest/expect-expect, vitest/valid-describe-callback, vitest/valid-title -- this module DECLARES no suite of its own: it hands the runner's primitives to oxlint's RuleTester, which declares one per rule case, so a literal title and an assertion are the CALLER's to carry */
import { RuleTester } from 'oxlint/plugins-dev';
import { it as declareCase, describe as declareSuite } from 'vitest';

import type { LintRule } from '../project/rule.js';

type OxlintRule = Parameters<RuleTester['run']>[1];

export function ruleTester(): RuleTester {
    // Aliased: the runner's hygiene rules would read `describe(…)`/`it(…)` as a suite being declared here.
    RuleTester.describe = (name, body) => {
        declareSuite(name, body);
    };
    RuleTester.it = (name, body) => {
        declareCase(name, body);
    };
    return new RuleTester();
}

/** A `LintRule` reads every node as an `AstNode`, oxlint types each handler with its node's interface, and neither is assignable to the other. */
export function asOxlintRule(rule: LintRule): OxlintRule {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the two shapes describe the same object; only the node each handler is typed with differs
    return rule as unknown as OxlintRule;
}
