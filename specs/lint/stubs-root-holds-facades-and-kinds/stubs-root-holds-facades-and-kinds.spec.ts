import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('stubs-root-holds-facades-and-kinds', () => {
    test('accepts a well-formed stubs/ tree', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a malformed stubs/ tree', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/app/widget/__setup__/stubs/grpc/thing.ts:1:1  jterrazz(stubs-root-holds-facades-and-kinds)
                found: \`__setup__/stubs/grpc/\` is no stub kind
                why: Under \`specs/**/__setup__/stubs/\`: the ROOT carries only \`*.stubs.ts\` facades and one folder per stub KIND, a kind being a stub builder \`@jterrazz/test/stubs\` exports (\`http\` | \`openai\` | \`anthropic\`, the closed list its exports decide).
                fix: move its units into the folder of the builder they call, one of \`anthropic/\`, \`http/\`, \`openai/\`
                read: docs/reference/linting.md#stubs-root-holds-facades-and-kinds
            specs/app/widget/__setup__/stubs/http/Bad_Name.ts:1:1  jterrazz(stubs-root-holds-facades-and-kinds)
                found: the stub unit "Bad_Name.ts" is not named \`<kebab-name>.ts\`
                why: Under \`specs/**/__setup__/stubs/\`: the ROOT carries only \`*.stubs.ts\` facades and one folder per stub KIND, a kind being a stub builder \`@jterrazz/test/stubs\` exports (\`http\` | \`openai\` | \`anthropic\`, the closed list its exports decide).
                fix: rename it in kebab-case, without the kind: the folder carries it
                read: docs/reference/linting.md#stubs-root-holds-facades-and-kinds
            specs/app/widget/__setup__/stubs/latest.ts:1:1  jterrazz(stubs-root-holds-facades-and-kinds)
                found: the stub unit "latest.ts" sits at the \`__setup__/stubs/\` root
                why: Under \`specs/**/__setup__/stubs/\`: the ROOT carries only \`*.stubs.ts\` facades and one folder per stub KIND, a kind being a stub builder \`@jterrazz/test/stubs\` exports (\`http\` | \`openai\` | \`anthropic\`, the closed list its exports decide).
                fix: move it into the folder of its kind, one of \`anthropic/\`, \`http/\`, \`openai/\`; the root holds only \`*.stubs.ts\` facades
                read: docs/reference/linting.md#stubs-root-holds-facades-and-kinds
            specs/app/widget/__setup__/stubs/openai/classify.ts:5:14  jterrazz(stubs-root-holds-facades-and-kinds)
                found: a stub under \`__setup__/stubs/openai/\` calls the \`http\` builder
                why: Under \`specs/**/__setup__/stubs/\`: the ROOT carries only \`*.stubs.ts\` facades and one folder per stub KIND, a kind being a stub builder \`@jterrazz/test/stubs\` exports (\`http\` | \`openai\` | \`anthropic\`, the closed list its exports decide).
                fix: move it to \`__setup__/stubs/http/\`, or build it with \`openai.*\` alone
                read: docs/reference/linting.md#stubs-root-holds-facades-and-kinds
            specs/app/widget/__setup__/stubs/openai/classify.ts:6:15  jterrazz(stubs-root-holds-facades-and-kinds)
                found: a stub under \`__setup__/stubs/openai/\` calls the \`http\` builder
                why: Under \`specs/**/__setup__/stubs/\`: the ROOT carries only \`*.stubs.ts\` facades and one folder per stub KIND, a kind being a stub builder \`@jterrazz/test/stubs\` exports (\`http\` | \`openai\` | \`anthropic\`, the closed list its exports decide).
                fix: move it to \`__setup__/stubs/http/\`, or build it with \`openai.*\` alone
                read: docs/reference/linting.md#stubs-root-holds-facades-and-kinds
        `);
    });
});
