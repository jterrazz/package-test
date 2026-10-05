import { describe, expect, test } from 'vitest';

import { listSimulators, sameRuntime, selectSimulator } from './simulator.js';

const LISTING = JSON.stringify({
    devices: {
        'com.apple.CoreSimulator.SimRuntime.iOS-18-2': [
            { isAvailable: true, name: 'iPhone 16 Pro', state: 'Shutdown', udid: 'AAAA-18' },
        ],
        'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [
            { isAvailable: true, name: 'iPhone 16 Pro', state: 'Booted', udid: 'AAAA-26' },
            { name: 'iPhone 17', state: 'Shutdown', udid: 'BBBB-26' },
            { isAvailable: false, name: 'iPhone 15', state: 'Shutdown', udid: 'CCCC-26' },
        ],
        'com.apple.CoreSimulator.SimRuntime.xrOS': [
            { isAvailable: true, name: 'Apple Vision Pro', state: 'Shutdown', udid: 'DDDD-XR' },
        ],
    },
});

const WHY = 'why: Resolution refuses rather than guesses: a device names exactly one simulator.';

/** The udid a selection answers, or the message of its refusal. */
function refusalOf(criteria: { name: string; os?: string }): string {
    try {
        return selectSimulator(LISTING, criteria).udid;
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

describe('simulator', () => {
    test('listSimulators — flattens the per-runtime record into readable os labels, without the unavailable devices', () => {
        // Given - the simctl listing, one runtime key of no known shape, one device whose runtime is gone
        // Then - each available device, its runtime read as a label or as itself
        expect(listSimulators(LISTING)).toStrictEqual([
            { name: 'iPhone 16 Pro', os: 'iOS 18.2', state: 'Shutdown', udid: 'AAAA-18' },
            { name: 'iPhone 16 Pro', os: 'iOS 26.5', state: 'Booted', udid: 'AAAA-26' },
            { name: 'iPhone 17', os: 'iOS 26.5', state: 'Shutdown', udid: 'BBBB-26' },
            {
                name: 'Apple Vision Pro',
                os: 'com.apple.CoreSimulator.SimRuntime.xrOS',
                state: 'Shutdown',
                udid: 'DDDD-XR',
            },
        ]);
    });

    test('listSimulators — a listing of another shape lists nothing', () => {
        // Given - listings that are no record, hold no devices record, or a runtime that is no list
        const listings = [null, {}, { devices: null }, { devices: { a: [], b: 'x' } }];

        // Then - none lists a device
        expect(listings.map((listing) => listSimulators(JSON.stringify(listing)))).toStrictEqual([
            [],
            [],
            [],
            [],
        ]);
    });

    test('sameRuntime — a bare version and a labelled one name one runtime, two labels must name the same platform', () => {
        // Given - pairs spelled each way
        const pairs: [string, string][] = [
            ['26.5', 'iOS 26.5'],
            [' iOS  26.5 ', 'ios 26.5'],
            ['iOS 26.5', 'watchOS 26.5'],
            ['26.5', '18.2'],
        ];

        // Then - the first two match, the others do not
        expect(pairs.map(([one, other]) => sameRuntime(one, other))).toStrictEqual([
            true,
            true,
            false,
            false,
        ]);
    });

    test('selectSimulator — picks the single device matching name and os, the os in any spelling', () => {
        // Given - a name carried by two runtimes, narrowed by a bare version, then by a label
        // Then - each narrows to one
        expect([
            selectSimulator(LISTING, { name: 'iPhone 16 Pro', os: '26.5' }).udid,
            selectSimulator(LISTING, { name: 'iPhone 16 Pro', os: 'ios 18.2' }).udid,
            selectSimulator(LISTING, { name: 'iPhone 17' }).udid,
        ]).toStrictEqual(['AAAA-26', 'AAAA-18', 'BBBB-26']);
    });

    test('selectSimulator — refuses a device no simulator matches with the full listing, and one several match with the matches', () => {
        // Given - a name that does not exist, one on an os it is not on, and one on two runtimes
        const listing = [
            '  iPhone 16 Pro — iOS 18.2 (Shutdown) AAAA-18',
            '  iPhone 16 Pro — iOS 26.5 (Booted) AAAA-26',
            '  iPhone 17 — iOS 26.5 (Shutdown) BBBB-26',
            '  Apple Vision Pro — com.apple.CoreSimulator.SimRuntime.xrOS (Shutdown) DDDD-XR',
        ];
        const missing = (wanted: string): string =>
            [
                `found: specification.mobile(): no simulator matches ${wanted}.`,
                'available devices:',
                ...listing,
                WHY,
                'fix: name one of the available devices, or create the simulator in Xcode',
                'read: docs/guides/mobile-specs.md#options',
            ].join('\n');

        // Then - each refusal, whole
        expect([
            refusalOf({ name: 'iPhone 3G' }),
            refusalOf({ name: 'iPhone 17', os: 'iOS 18.2' }),
            refusalOf({ name: 'iPhone 16 Pro' }),
        ]).toStrictEqual([
            missing('"iPhone 3G"'),
            missing('"iPhone 17" on iOS 18.2'),
            [
                'found: specification.mobile(): 2 simulators match "iPhone 16 Pro".',
                'matched:',
                ...listing.slice(0, 2),
                WHY,
                'fix: add `os:` or `udid:` to pick one',
                'read: docs/guides/mobile-specs.md#options',
            ].join('\n'),
        ]);
    });
});
