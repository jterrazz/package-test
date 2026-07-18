import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { a10DuplicateBinding } from './a10-duplicate-binding.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('a10-duplicate-binding', a10DuplicateBinding as unknown as OxlintRule, {
    invalid: [
        // Two keys kebab-collide onto the same compose service.
        {
            code: `specification.api({ services: { analyticsDb: postgres(), "analytics-db": postgres() } });`,
            errors: 1,
        },
        // Explicit composeService collides with another key's derivation.
        {
            code: `specification.api({ services: { analyticsDb: postgres(), metrics: postgres({ composeService: "analytics-db" }) } });`,
            errors: 1,
        },
    ],
    valid: [
        // Distinct bindings.
        {
            code: `specification.api({ services: { db: postgres(), cache: redis() } });`,
        },
        // Distinct explicit compose services.
        {
            code: `specification.api({ services: { a: postgres({ composeService: "one" }), b: postgres({ composeService: "two" }) } });`,
        },
    ],
});
