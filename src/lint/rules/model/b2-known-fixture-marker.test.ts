import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { b2KnownFixtureMarker } from './b2-known-fixture-marker.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('b2-known-fixture-marker', b2KnownFixtureMarker as unknown as OxlintRule, {
    invalid: [
        // Unknown marker.
        { code: 'cli.fixture("$SHARED/app/");', errors: 1 },
        // Casing matters — the marker list is exact.
        { code: 'cli.fixture("$fixtures/app/");', errors: 1 },
        // Bare unknown marker without a rest.
        { code: 'cli.fixture("$POOL");', errors: 1 },
        // Interpolated path — the leading quasi still carries an unknown marker.
        { code: `cli.fixture(\`$POOL/\${name}/\`);`, errors: 1 },
    ],
    valid: [
        // The one known marker, in both shapes.
        { code: 'cli.fixture("$FIXTURES/cli-app/");' },
        { code: 'cli.fixture("$FIXTURES");' },
        // Known marker on an interpolated path.
        { code: `cli.fixture(\`$FIXTURES/\${app}/\`);` },
        // Feature-local paths carry no marker.
        { code: 'cli.fixture("spwn-seed/");' },
        // Dynamic paths are out of static reach.
        { code: 'cli.fixture(path);' },
        // Other .fixture methods on other objects still validate paths — but
        // Non-$ literals never report.
        { code: 'registry.fixture("plain");' },
    ],
});
