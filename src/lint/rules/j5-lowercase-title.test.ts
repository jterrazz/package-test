import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { j5LowercaseTitle } from './j5-lowercase-title.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('j5-lowercase-title', j5LowercaseTitle as unknown as OxlintRule, {
    invalid: [
        { code: "test('Rejects an unknown job', () => {});", errors: 1 },
        { code: "describe('Hexagonal architecture', () => {});", errors: 1 },
        { code: "test.only('Builds the app', () => {});", errors: 1 },
    ],
    valid: [
        { code: "test('rejects an unknown job', () => {});" },
        { code: "describe('hexagonal architecture', () => {});" },
        { code: "test.only('builds the app', () => {});" },
        // Title opening on a non-letter — left alone.
        { code: "test('$FIXTURES resolves the pool', () => {});" },
        { code: "test('{{uuid}} is captured once', () => {});" },
        // A digit-led title opens on a non-letter — out of scope, left alone.
        { code: "test('3 retries before the run fails', () => {});" },
        // Identifier-shaped all-caps/underscored first word — names a symbol, exempt.
        { code: "test('VALID_CATEGORIES rejects an unknown value', () => {});" },
        { code: "describe('HTTP is upgraded to h2', () => {});" },
        { code: "test('DI wires the container', () => {});" },
        // Not a titled runner.
        { code: "expect(value).toBe('Something');" },
    ],
});
