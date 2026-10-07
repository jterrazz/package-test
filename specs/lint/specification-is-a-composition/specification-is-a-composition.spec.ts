import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('specification-is-a-composition', () => {
    test('a composition file holding its composition alone, and a constructor that opens it, pass', async () => {
        // Given - the composed tree
        const result = await lint.fixture(directory('./__fixtures__/composed/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a composition file holding logic, and a constructor running a step, are refused', async () => {
        // Given - the logic tree
        const result = await lint.fixture(directory('./__fixtures__/logic/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/specifications/job/job.composition.ts:18:1  jterrazz-self(specification-is-a-composition)
                found: a function declaration in a composition file, which holds its composition alone
                why: A composition file — \`src/specifications/<specification>/<specification>.composition.ts\` — is a composition and nothing else: its imports, one \`const composition = { … }\` listing the setups, the actions and the constructor options it composes, the chain type it names as an interface, and one exported \`defineSpecification<…>()({ … })\` — the definer handed nothing — whose \`adapters\` is an arrow, each parameter a bare name with no default nor pattern, handing back the object of the adapters it wires; any other statement — a function, a class, a variable, a call — is an error.
                fix: move the logic to the capability, the action or the adapter that owns it; a composition file lists definitions and wires adapters
                read: docs/guides/test.md#specification-is-a-composition
            src/specifications/job/job.composition.ts:24:72  jterrazz-self(specification-is-a-composition)
                found: the adapter \`jobs\` is a call expression written in the specification, not one its adapter module builds
                why: A composition file — \`src/specifications/<specification>/<specification>.composition.ts\` — is a composition and nothing else: its imports, one \`const composition = { … }\` listing the setups, the actions and the constructor options it composes, the chain type it names as an interface, and one exported \`defineSpecification<…>()({ … })\` — the definer handed nothing — whose \`adapters\` is an arrow, each parameter a bare name with no default nor pattern, handing back the object of the adapters it wires; any other statement — a function, a class, a variable, a call — is an error.
                fix: name the adapter, or call the constructor its adapter module exports — under the notion it adapts (\`src/stubs/\`, \`src/services/\`, \`src/disk/\`, \`src/clock/\`, \`src/mocks/\`), or in a concept folder of the specification — on the config alone
                read: docs/guides/test.md#specification-is-a-composition
            src/specifications/job/job.handle.ts:7:11  jterrazz-self(specification-is-a-composition)
                found: the constructor calls \`trigger.perform()\`, a step of a definition
                why: A composition file — \`src/specifications/<specification>/<specification>.composition.ts\` — is a composition and nothing else: its imports, one \`const composition = { … }\` listing the setups, the actions and the constructor options it composes, the chain type it names as an interface, and one exported \`defineSpecification<…>()({ … })\` — the definer handed nothing — whose \`adapters\` is an arrow, each parameter a bare name with no default nor pattern, handing back the object of the adapters it wires; any other statement — a function, a class, a variable, a call — is an error.
                fix: open the specification (\`<name>Definition.open(config)\`) and let the chain run the definitions it composes
                read: docs/guides/test.md#specification-is-a-composition
            src/specifications/job/job.handle.ts:8:20  jterrazz-self(specification-is-a-composition)
                found: the constructor builds a \`BaseResult\`, a result
                why: A composition file — \`src/specifications/<specification>/<specification>.composition.ts\` — is a composition and nothing else: its imports, one \`const composition = { … }\` listing the setups, the actions and the constructor options it composes, the chain type it names as an interface, and one exported \`defineSpecification<…>()({ … })\` — the definer handed nothing — whose \`adapters\` is an arrow, each parameter a bare name with no default nor pattern, handing back the object of the adapters it wires; any other statement — a function, a class, a variable, a call — is an error.
                fix: let the action the chain ends on construct what it hands back; the constructor opens the specification (\`<name>Definition.open(config)\`)
                read: docs/guides/test.md#specification-is-a-composition
        `);
    });
});
