import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as preset } from '../preset-lint.specification.js';

describe('no-second-test-runtime', () => {
    test("accepts the framework's own chain", async () => {
        // Given - the compliant tree
        const result = await preset.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a second renderer imported by a test', async () => {
        // Given - the violation tree
        const result = await preset.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/widget.test.ts:1:22  architecture(no-second-test-runtime-clock)
                found: \`src/widget.test.ts\` imports \`mockdate\`
                why: A test file imports no second test runtime: \`@testing-library/*\`, \`happy-dom\`, \`jsdom\`, \`vitest/browser\`, \`vitest-browser-*\`, \`@vitest/browser*\`, \`msw\`, \`msw/*\`, \`nock\`, \`sinon\`, \`vitest-mock-extended\`, \`jest\`, \`@jest/*\`, \`mockdate\`, \`playwright\`, \`playwright-core\`, \`@playwright/test\`, \`webdriverio\` and \`appium\` are errors, one layer per seam — \`no-second-test-runtime-<seam>\` — each named with what replaces it; \`react-dom/server\` is one too, in the \`module\` role alone.
                fix: time is one primitive — \`using _ = clock.at(iso)\` pins the calendar and gives it back at the end of the scope
                read: docs/24-linting.md#no-second-test-runtime
            src/widget.test.ts:2:29  architecture(no-second-test-runtime-network)
                found: \`src/widget.test.ts\` imports \`msw/node\`
                why: A test file imports no second test runtime: \`@testing-library/*\`, \`happy-dom\`, \`jsdom\`, \`vitest/browser\`, \`vitest-browser-*\`, \`@vitest/browser*\`, \`msw\`, \`msw/*\`, \`nock\`, \`sinon\`, \`vitest-mock-extended\`, \`jest\`, \`@jest/*\`, \`mockdate\`, \`playwright\`, \`playwright-core\`, \`@playwright/test\`, \`webdriverio\` and \`appium\` are errors, one layer per seam — \`no-second-test-runtime-<seam>\` — each named with what replaces it; \`react-dom/server\` is one too, in the \`module\` role alone.
                fix: the network answers through stubs — \`await using _ = await intercept(defineStubs(…))\` in module scope, \`.intercept()\` on a chain
                read: docs/24-linting.md#no-second-test-runtime
            src/widget.test.ts:3:38  architecture(no-second-test-runtime-string-renderer)
                found: \`src/widget.test.ts\` imports \`react-dom/server\`
                why: A test file imports no second test runtime: \`@testing-library/*\`, \`happy-dom\`, \`jsdom\`, \`vitest/browser\`, \`vitest-browser-*\`, \`@vitest/browser*\`, \`msw\`, \`msw/*\`, \`nock\`, \`sinon\`, \`vitest-mock-extended\`, \`jest\`, \`@jest/*\`, \`mockdate\`, \`playwright\`, \`playwright-core\`, \`@playwright/test\`, \`webdriverio\` and \`appium\` are errors, one layer per seam — \`no-second-test-runtime-<seam>\` — each named with what replaces it; \`react-dom/server\` is one too, in the \`module\` role alone.
                fix: a component rendered to a string is still a component — the test is a \`.test.tsx\` beside it, and \`result.html\` carries the markup
                read: docs/24-linting.md#no-second-test-runtime
            src/widget.test.ts:5:26  architecture(no-second-test-runtime-doubles)
                found: \`src/widget.test.ts\` imports \`vitest-mock-extended\`
                why: A test file imports no second test runtime: \`@testing-library/*\`, \`happy-dom\`, \`jsdom\`, \`vitest/browser\`, \`vitest-browser-*\`, \`@vitest/browser*\`, \`msw\`, \`msw/*\`, \`nock\`, \`sinon\`, \`vitest-mock-extended\`, \`jest\`, \`@jest/*\`, \`mockdate\`, \`playwright\`, \`playwright-core\`, \`@playwright/test\`, \`webdriverio\` and \`appium\` are errors, one layer per seam — \`no-second-test-runtime-<seam>\` — each named with what replaces it; \`react-dom/server\` is one too, in the \`module\` role alone.
                fix: the doubles ladder is closed — \`mockOf<Port>()\` for an injected interface, \`vi.fn()\` for a function, \`vi.spyOn\` for an object the test passes in
                read: docs/24-linting.md#no-second-test-runtime
        `);
    });
});
