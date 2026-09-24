import { describe, expect, test } from 'vitest';

import { mobileSessionSetup } from '../../runner/facet-project.js';
import { inPlaceSetup } from '../../runner/preset.js';
import { mobile } from './mobile.project.js';

describe('mobile() — one driver session per run', () => {
    test("carries the setup that holds the run's session, beside update mode's", () => {
        // Given - the canonical mobile project, stated by nobody
        const setups = mobile().test?.globalSetup;

        // Then - update mode's setup, and the one that holds the run's session
        expect(setups).toStrictEqual([inPlaceSetup(), mobileSessionSetup()]);
        expect(mobileSessionSetup()).toMatch(/mobile-session\.ts$/u);
    });
});
