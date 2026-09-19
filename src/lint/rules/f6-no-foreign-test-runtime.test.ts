import { asOxlintRule, ruleTester } from '../rule-tester.fixtures.js';
import { f6NoForeignTestRuntime } from './f6-no-foreign-test-runtime.js';

const tester = ruleTester();

const MODULE_TEST = '/repo/src/ui/post-client.test.ts';
const COMPONENT_TEST = '/repo/src/ui/post-table.test.tsx';

tester.run('f6-no-foreign-test-runtime', asOxlintRule(f6NoForeignTestRuntime), {
    invalid: [
        {
            code: 'import { render } from "@testing-library/react";',
            errors: [{ messageId: 'foreignRuntime' }],
            filename: COMPONENT_TEST,
        },
        {
            code: 'import { Window } from "happy-dom";',
            errors: [{ messageId: 'foreignRuntime' }],
            filename: MODULE_TEST,
        },
        {
            code: 'import { JSDOM } from "jsdom";',
            errors: [{ messageId: 'foreignRuntime' }],
            filename: MODULE_TEST,
        },
        {
            code: 'import { page } from "vitest/browser";',
            errors: [{ messageId: 'foreignRuntime' }],
            filename: COMPONENT_TEST,
        },
        {
            code: 'import { render } from "vitest-browser-react";',
            errors: [{ messageId: 'foreignRuntime' }],
            filename: COMPONENT_TEST,
        },
    ],
    valid: [
        // The framework's own entry is the one a spec imports (F1).
        { code: 'import { component } from "@jterrazz/test";', filename: COMPONENT_TEST },
        // The runner itself is not a foreign runtime.
        { code: 'import { expect, test } from "vitest";', filename: MODULE_TEST },
        // The seam that OWNS the adapter is production code, not a test file.
        {
            code: 'import { page } from "vitest/browser";',
            filename: '/repo/src/integrations/vitest-browser/adapter.ts',
        },
        // A fixture project's own config has to name the provider it runs on.
        {
            code: 'import { playwright } from "@vitest/browser-playwright";',
            filename: '/repo/specs/_fixtures/app/vitest.config.ts',
        },
        // A providers module is the app's frame, not a spec speaking a dialect.
        {
            code: 'import { render } from "vitest-browser-react";',
            filename: '/repo/specs/component-app/providers.tsx',
        },
    ],
});
