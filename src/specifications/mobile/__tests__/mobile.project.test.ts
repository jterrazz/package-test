import { describe, expect, test } from 'vitest';

import { mobile } from '../mobile.project.js';
import { mobileSessionSetup } from '../session/mobile-session.global-setup.js';

describe('mobile', () => {
    test("mobile() — runs its files one at a time in group 1, after the projects of group 0, a global setup holding the run's session, and serves the declared device from its root", () => {
        // Given - a project with no device, and one declaring a device with and without a root
        const plain = mobile().test;
        const served = mobile({ device: { name: 'iPhone 17' }, root: 'apps/mobile' }).test;
        const rooted = mobile({ device: { name: 'iPhone 17' } }).test;

        // Then - each runs serially, after group 0, and the declared device is provided to its setup
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
            [false, true, 1, undefined],
            { mobileAppium: { device: { name: 'iPhone 17' }, root: 'apps/mobile' } },
            { mobileAppium: { device: { name: 'iPhone 17' }, root: '.' } },
        ]);
    });

    test('mobile() — runs its files in parallel in group 0 where the project states `serial: false`, its server giving each session an app of its own', () => {
        // Given - a project stated parallel, and one stated serial
        const parallel = mobile({ serial: false }).test;
        const serial = mobile({ serial: true }).test;

        // Then - the first leaves vitest's file parallelism on beside every project, the second runs alone after them
        expect([
            [parallel?.fileParallelism, parallel?.sequence?.groupOrder],
            [serial?.fileParallelism, serial?.sequence?.groupOrder],
        ]).toStrictEqual([
            [undefined, 0],
            [false, 1],
        ]);
    });
});
