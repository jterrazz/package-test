import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { a6wRedundantComposeService } from './a6w-redundant-compose-service.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run(
    'a6w-redundant-compose-service',
    a6wRedundantComposeService as unknown as OxlintRule,
    {
        invalid: [
            // Equal to the kebab-case derivation of the key.
            {
                code: `await specification.api({
                    services: { analyticsDb: postgres({ composeService: "analytics-db" }) },
                });`,
                errors: 1,
            },
            // Equal to the key itself.
            {
                code: `await specification.api({
                    services: { cache: redis({ composeService: "cache" }) },
                });`,
                errors: 1,
            },
        ],
        valid: [
            // Non-derivable name — the escape hatch earns its keep.
            {
                code: `await specification.api({
                    services: { events: postgres({ composeService: "legacy_event_store" }) },
                });`,
            },
            // No composeService at all.
            {
                code: `await specification.api({
                    services: { analyticsDb: postgres() },
                });`,
            },
            // Outside a specification call the option is not ours to judge.
            { code: 'configure({ services: { db: postgres({ composeService: "db" }) } });' },
        ],
    },
);
