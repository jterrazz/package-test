import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('facet-is-a-composition', () => {
    test('a facet file holding its composition alone, and a constructor that opens it, pass', async () => {
        // Given - the composed tree
        const result = await lint.fixture(directory('./_fixtures/composed/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a facet file holding logic, and a constructor running a step, are refused', async () => {
        // Given - the logic tree
        const result = await lint.fixture(directory('./_fixtures/logic/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/facets/job/job.facet.ts:18:1  jterrazz-self(facet-is-a-composition)
                found: a function declaration in a facet file, which holds its composition alone
                why: A facet file — \`src/facets/<facet>/<facet>.facet.ts\` — is a composition and nothing else: its imports, one \`const composition = { … }\` listing the setups, the actions and the constructor options it composes, the chain type it names as an interface, and one exported \`defineFacet<…>()({ … })\` — the definer handed nothing — whose \`adapters\` is an arrow, each parameter a bare name with no default nor pattern, handing back the object of the adapters it wires; any other statement — a function, a class, a variable, a call — is an error.
                fix: move the logic to the capability, the action or the adapter that owns it; a facet file lists definitions and wires adapters
                read: docs/03-testing.md#facet-is-a-composition
            src/facets/job/job.facet.ts:24:72  jterrazz-self(facet-is-a-composition)
                found: the adapter \`jobs\` is a call expression written in the facet, not one its adapter module builds
                why: A facet file — \`src/facets/<facet>/<facet>.facet.ts\` — is a composition and nothing else: its imports, one \`const composition = { … }\` listing the setups, the actions and the constructor options it composes, the chain type it names as an interface, and one exported \`defineFacet<…>()({ … })\` — the definer handed nothing — whose \`adapters\` is an arrow, each parameter a bare name with no default nor pattern, handing back the object of the adapters it wires; any other statement — a function, a class, a variable, a call — is an error.
                fix: name the adapter, or call the constructor its adapter module exports — under the notion it adapts (\`src/stubs/\`, \`src/services/\`, \`src/disk/\`, \`src/clock/\`, \`src/mocks/\`), or in a concept folder of the facet — on the config alone
                read: docs/03-testing.md#facet-is-a-composition
            src/facets/job/job.handle.ts:7:11  jterrazz-self(facet-is-a-composition)
                found: the constructor calls \`trigger.perform()\`, a step of a definition
                why: A facet file — \`src/facets/<facet>/<facet>.facet.ts\` — is a composition and nothing else: its imports, one \`const composition = { … }\` listing the setups, the actions and the constructor options it composes, the chain type it names as an interface, and one exported \`defineFacet<…>()({ … })\` — the definer handed nothing — whose \`adapters\` is an arrow, each parameter a bare name with no default nor pattern, handing back the object of the adapters it wires; any other statement — a function, a class, a variable, a call — is an error.
                fix: open the facet (\`<facet>Facet.open(config)\`) and let the chain run the definitions it composes
                read: docs/03-testing.md#facet-is-a-composition
            src/facets/job/job.handle.ts:8:20  jterrazz-self(facet-is-a-composition)
                found: the constructor builds a \`BaseResult\`, a result
                why: A facet file — \`src/facets/<facet>/<facet>.facet.ts\` — is a composition and nothing else: its imports, one \`const composition = { … }\` listing the setups, the actions and the constructor options it composes, the chain type it names as an interface, and one exported \`defineFacet<…>()({ … })\` — the definer handed nothing — whose \`adapters\` is an arrow, each parameter a bare name with no default nor pattern, handing back the object of the adapters it wires; any other statement — a function, a class, a variable, a call — is an error.
                fix: let the action the chain ends on construct what it hands back; the constructor opens the facet (\`<facet>Facet.open(config)\`)
                read: docs/03-testing.md#facet-is-a-composition
        `);
    });
});
