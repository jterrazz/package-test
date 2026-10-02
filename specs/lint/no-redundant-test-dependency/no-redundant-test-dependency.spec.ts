import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('no-redundant-test-dependency', () => {
    test("the React Native testing library passes where jest runs the member's tests", async () => {
        // Given - the member-workspace tree
        const result = await checker
            .fixture(directory('../../_shared/_fixtures/member-workspace/'))
            .run({ args: '--member packages/rn-jest' });
        const next = await checker
            .fixture(directory('../../_shared/_fixtures/member-workspace/'))
            .run({ args: '--member packages/rn-library' });

        // Then - nothing is reported
        expect(result.report).toMatch('');
        expect(next.report).toMatch('');
    });

    test('a dependency the framework carries, or a seam it replaced, is refused where declared', async () => {
        // Given - the member-workspace tree
        const result = await checker
            .fixture(directory('../../_shared/_fixtures/member-workspace/'))
            .run({ args: '--member packages/seam-dependency' });
        const next = await checker
            .fixture(directory('../../_shared/_fixtures/member-workspace/'))
            .run({ args: '--member apps/site/packages/nested' });

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            packages/seam-dependency/package.json:4:1  jterrazz-check(no-redundant-test-dependency)
                found: packages/seam-dependency: \`@testing-library/react\` is a seam \`@jterrazz/test\` replaced
                why: A member declares no dependency \`@jterrazz/test\` already carries (\`msw\`, \`vitest-mock-extended\`; \`yaml\` in devDependencies only — as a production dependency it is the product’s own library) and no retired seam (\`happy-dom\`, \`jsdom\`, \`@testing-library/*\`, \`@playwright/test\`, \`mockdate\`) — except \`@testing-library/react-native\` where jest runs the tests of the member — the only vocabulary that runtime has until the React Native answer lands.
                fix: remove \`@testing-library/react\` from packages/seam-dependency/package.json, and write its tests on \`component()\`, \`website()\`, \`clock\` or \`intercept()\`
                read: docs/19-linting.md#no-redundant-test-dependency
            packages/seam-dependency/package.json:5:1  jterrazz-check(no-redundant-test-dependency)
                found: packages/seam-dependency: \`msw\` is a transitive of \`@jterrazz/test\`
                why: A member declares no dependency \`@jterrazz/test\` already carries (\`msw\`, \`vitest-mock-extended\`; \`yaml\` in devDependencies only — as a production dependency it is the product’s own library) and no retired seam (\`happy-dom\`, \`jsdom\`, \`@testing-library/*\`, \`@playwright/test\`, \`mockdate\`) — except \`@testing-library/react-native\` where jest runs the tests of the member — the only vocabulary that runtime has until the React Native answer lands.
                fix: remove \`msw\` from packages/seam-dependency/package.json
                read: docs/19-linting.md#no-redundant-test-dependency
        `);
        expect(next.report).toMatch(`
            apps/site/packages/nested/package.json:3:1  jterrazz-check(no-redundant-test-dependency)
                found: apps/site/packages/nested: \`mockdate\` is a seam \`@jterrazz/test\` replaced
                why: A member declares no dependency \`@jterrazz/test\` already carries (\`msw\`, \`vitest-mock-extended\`; \`yaml\` in devDependencies only — as a production dependency it is the product’s own library) and no retired seam (\`happy-dom\`, \`jsdom\`, \`@testing-library/*\`, \`@playwright/test\`, \`mockdate\`) — except \`@testing-library/react-native\` where jest runs the tests of the member — the only vocabulary that runtime has until the React Native answer lands.
                fix: remove \`mockdate\` from apps/site/packages/nested/package.json, and write its tests on \`component()\`, \`website()\`, \`clock\` or \`intercept()\`
                read: docs/19-linting.md#no-redundant-test-dependency
        `);
    });
});
