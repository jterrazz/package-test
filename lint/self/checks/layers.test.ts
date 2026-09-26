import { describe, expect, test } from 'vitest';

import { importWithinDeclaredLayers } from '../../consumer/rules/architecture/import-within-declared-layers.js';
import { asOxlintRule, ruleTester } from '../../engine/testing/rule-tester.fixtures.js';
import { FRAMEWORK_LAYERS } from './layers.js';

/* Lock 2: a reverse edge fails here even while no module uses it yet. */

const own = [{ layers: FRAMEWORK_LAYERS }];

describe('FRAMEWORK_LAYERS', () => {
    test('names every tree of the source root, and lint beside it', () => {
        // Given - the map this package hands its own lint
        const trees = Object.keys(FRAMEWORK_LAYERS).toSorted();

        // Then - no tree is left out of the direction the rule enforces
        expect(trees).toStrictEqual([
            'elements',
            'expectations',
            'facets',
            'kernel',
            'lint',
            'vitest',
            'world',
        ]);
    });

    ruleTester().run(
        "import-within-declared-layers (the package's own map refuses a reverse edge)",
        asOxlintRule(importWithinDeclaredLayers),
        {
            invalid: [
                // The kernel knows none of the layers built on it.
                {
                    code: 'import { pinClock } from "../../world/clock/clock.js";',
                    errors: [{ messageId: 'crossLayer' }],
                    filename: '/repo/src/kernel/chain/chain.ts',
                    options: own,
                },
                {
                    code: 'import { apiFacet } from "../../facets/api/index.js";',
                    errors: [{ messageId: 'crossLayer' }],
                    filename: '/repo/src/kernel/chain/define-facet.ts',
                    options: own,
                },
                // Nor does it reach an engine a slice owns.
                {
                    code: 'import { Client } from "pg";',
                    errors: [{ messageId: 'foreignDependency' }],
                    filename: '/repo/src/kernel/chain/perform.ts',
                    options: own,
                },
                // What surrounds the subject never reaches what is tested.
                {
                    code: 'import { api } from "../../../facets/api/index.js";',
                    errors: [{ messageId: 'crossLayer' }],
                    filename: '/repo/src/world/stubs/http/http.ts',
                    options: own,
                },
                // The three shared layers reach the kernel, not each other.
                {
                    code: 'import { declaredDatabaseKeys } from "../world/services/services.js";',
                    errors: [{ messageId: 'crossLayer' }],
                    filename: '/repo/src/expectations/result.ts',
                    options: own,
                },
                {
                    code: 'import { button } from "../../elements/elements.js";',
                    errors: [{ messageId: 'crossLayer' }],
                    filename: '/repo/src/world/clock/clock.ts',
                    options: own,
                },
                {
                    code: 'import { websiteFacet } from "../facets/website/index.js";',
                    errors: [{ messageId: 'crossLayer' }],
                    filename: '/repo/src/elements/elements.ts',
                    options: own,
                },
                // A facet reaches the project kit only from its project, never from test code.
                {
                    code: 'import { onProjectDefaults } from "../../../vitest/project-kit.js";',
                    errors: [{ messageId: 'crossLayer' }],
                    filename: '/repo/src/facets/api/request/route.ts',
                    options: own,
                },
                // A facet folder owns its own engine, not a sibling's.
                {
                    code: 'import { chromium } from "playwright";',
                    errors: [{ messageId: 'foreignDependency' }],
                    filename: '/repo/src/facets/api/server/hono.adapter.ts',
                    options: own,
                },
                // A stub reaches the token grammar only from the modules the seam names.
                {
                    code: 'import { CaptureScope } from "../../../expectations/tokens/match.js";',
                    errors: [{ messageId: 'crossLayer' }],
                    filename: '/repo/src/world/stubs/openai/openai.ts',
                    options: own,
                },
            ],
            valid: [
                // The runner config assembles each facet's project.
                {
                    code: 'import { api } from "../facets/api/api.project.js";',
                    filename: '/repo/src/vitest/projects.ts',
                    options: own,
                },
                // A facet's project builds on the project kit: the one declared seam.
                {
                    code: 'import { onProjectDefaults } from "../../vitest/project-kit.js";',
                    filename: '/repo/src/facets/api/api.project.ts',
                    options: own,
                },
                // A facet reaches every shared layer below it.
                {
                    code: 'import { BaseResult } from "../../expectations/result.js";',
                    filename: '/repo/src/facets/job/trigger.action.ts',
                    options: own,
                },
                {
                    code: 'import { chromium } from "playwright";',
                    filename: '/repo/src/facets/website/browser/playwright.adapter.ts',
                    options: own,
                },
                // A stub's request filter IS an expectation on the outgoing request.
                {
                    code: 'import { CaptureScope } from "../../../expectations/tokens/match.js";',
                    filename: '/repo/src/world/stubs/http/http.ts',
                    options: own,
                },
            ],
        },
    );
});
