import { describe, expect, test } from 'vitest';

import { mobile } from '../mobile.project.js';
import { mobileSessionSetup } from '../session/mobile-session.global-setup.js';

describe('mobile', () => {
    test("mobile() — runs its files one at a time in the third group, a global setup holding the run's session, and serves the declared device from its root", () => {
        // Given - a project with no device, and one declaring a device with and without a root
        const plain = mobile().test;
        const served = mobile({ device: { name: 'iPhone 17' }, root: 'apps/mobile' }).test;
        const rooted = mobile({ device: { name: 'iPhone 17' } }).test;

        // Then - each runs serially after the others, and the declared device is provided to its setup
        expect([
            [
                plain?.fileParallelism,
                [plain?.globalSetup ?? []].flat().includes(mobileSessionSetup()),
                plain?.sequence?.groupOrder,
                plain?.provide,
            ],
            served?.provide,
            rooted?.provide,
        ]).toStrictEqual([
            [false, true, 3, undefined],
            { mobileAppium: { device: { name: 'iPhone 17' }, root: 'apps/mobile' } },
            { mobileAppium: { device: { name: 'iPhone 17' }, root: '.' } },
        ]);
    });
});
