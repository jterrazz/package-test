/* oxlint-disable vitest/expect-expect, vitest/valid-describe-callback, vitest/valid-title -- this module DECLARES no suite of its own: it hands the runner's primitives to oxlint's RuleTester, which declares one per rule case, so a literal title and an assertion are the CALLER's to carry */
import { RuleTester } from 'oxlint/plugins-dev';
import { it as declareCase, describe as declareSuite } from 'vitest';

import type { LintRule } from './types.js';

/**
 * One wiring of oxlint's `RuleTester`, for every rule test in this layer.
 *
 * The tester reaches for a describe/it pair and for oxlint's own `Rule` type,
 * which the package does not export — so each rule test used to open on the
 * same four lines and the same boundary cast. Stating them once is what keeps a
 * new rule's test about the RULE.
 *
 * It is a `*.fixtures.ts` because that is what it IS: material a test stands on,
 * importable only from a test (F5), and not production code the layer map or
 * the prod-import ban should reach (F2/I1).
 */

/** oxlint's own rule shape, named through the only place it surfaces. */
type OxlintRule = Parameters<RuleTester['run']>[1];

/** A tester bound to vitest's runner. */
export function ruleTester(): RuleTester {
    // Aliased on import: the runner's own hygiene rules read `describe(…)` and
    // `it(…)` as a suite being DECLARED, and here they are being handed to a
    // Tester that will declare them itself, once per rule case.
    RuleTester.describe = (name, body) => {
        declareSuite(name, body);
    };
    RuleTester.it = (name, body) => {
        declareCase(name, body);
    };
    return new RuleTester();
}

/**
 * The boundary cast: oxlint does not export its `Rule` type, and the structural
 * {@link LintRule} this layer writes against is deliberately decoupled from its
 * internal (alpha) typings.
 */
export function asOxlintRule(rule: LintRule): OxlintRule {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the two shapes describe the same object; only oxlint's is unpublished
    return rule as unknown as OxlintRule;
}
