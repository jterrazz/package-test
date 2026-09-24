import { describe, expect, test } from 'vitest';

import { mobileSessionSetup } from '../../runner/facet-project.js';
import { inPlaceSetup, tempRootSetup } from '../../runner/preset.js';
import { mobile } from './mobile.project.js';

describe('mobile() — one driver session per run', () => {
    test("carries the setup that holds the run's session, beside the preset's", () => {
        // Given - the canonical mobile project, stated by nobody
        const setups = mobile().test?.globalSetup;

        // Then - the preset's two setups, and the one that holds the run's session
        expect(setups).toStrictEqual([inPlaceSetup(), tempRootSetup(), mobileSessionSetup()]);
        expect(mobileSessionSetup()).toMatch(/mobile-session\.ts$/u);
    });

    test('hands its setup the device and the appium root it declares, and nothing when it declares none', () => {
        // Given - one project declaring its simulator and appium root, one bare
        const declared = mobile({ device: { name: 'iPhone 17', os: '26.0' }, root: 'app' });

        // Then - the declaration reaches the setup, the root defaulting to the config's
        expect(declared.test?.provide).toStrictEqual({
            mobileAppium: { device: { name: 'iPhone 17', os: '26.0' }, root: 'app' },
        });
        expect(mobile({ device: { name: 'iPhone 17' } }).test?.provide).toStrictEqual({
            mobileAppium: { device: { name: 'iPhone 17' }, root: '.' },
        });
        expect(mobile().test?.provide).toBeUndefined();
    });
});
