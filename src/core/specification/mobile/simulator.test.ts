import { describe, expect, test } from 'vitest';

import { listSimulators, selectSimulator } from './simulator.js';

const LISTING = JSON.stringify({
    devices: {
        'com.apple.CoreSimulator.SimRuntime.iOS-18-2': [
            { isAvailable: true, name: 'iPhone 16 Pro', state: 'Shutdown', udid: 'AAAA-18' },
        ],
        'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [
            { isAvailable: true, name: 'iPhone 16 Pro', state: 'Booted', udid: 'AAAA-26' },
            { isAvailable: true, name: 'iPhone 17', state: 'Shutdown', udid: 'BBBB-26' },
            { isAvailable: false, name: 'iPhone 15', state: 'Shutdown', udid: 'CCCC-26' },
        ],
        'com.apple.CoreSimulator.SimRuntime.watchOS-11-2': [
            { isAvailable: true, name: 'Apple Watch Ultra 2', state: 'Shutdown', udid: 'DDDD-11' },
        ],
    },
});

describe('listSimulators', () => {
    test('flattens the per-runtime record into readable os labels', () => {
        // Given - the simctl listing
        const devices = listSimulators(LISTING);

        // Then - runtime keys become human labels
        expect(devices).toContainEqual({
            name: 'iPhone 17',
            os: 'iOS 26.5',
            state: 'Shutdown',
            udid: 'BBBB-26',
        });
    });

    test('drops unavailable devices', () => {
        // Given - a listing with a device whose runtime is gone
        const devices = listSimulators(LISTING);

        // Then - it never becomes a candidate
        expect(devices.map((device) => device.udid)).not.toContain('CCCC-26');
    });
});

describe('selectSimulator', () => {
    test('picks the single device matching name and os', () => {
        // Given - a name carried by two runtimes, narrowed by os
        const device = selectSimulator(LISTING, { name: 'iPhone 16 Pro', os: '26.5' });

        // Then - the bare version narrows to one
        expect(device.udid).toBe('AAAA-26');
    });

    test('accepts the full os label case-insensitively', () => {
        // Given - the label form
        const device = selectSimulator(LISTING, { name: 'iPhone 16 Pro', os: 'ios 18.2' });

        // Then - it resolves the same as the bare version
        expect(device.udid).toBe('AAAA-18');
    });

    test('refuses an unknown name with the full device listing', () => {
        // Given - a device that does not exist
        // Then - the refusal lists what does, so the fix needs no Xcode round-trip
        expect(() => selectSimulator(LISTING, { name: 'iPhone 3G' })).toThrow(
            /no simulator matches "iPhone 3G"[\s\S]*iPhone 17 — iOS 26\.5/,
        );
    });

    test('refuses an ambiguous name and points at the os and udid options', () => {
        // Given - a name present on two runtimes, no os given
        // Then - the framework never guesses which one a spec meant
        expect(() => selectSimulator(LISTING, { name: 'iPhone 16 Pro' })).toThrow(
            /2 simulators match "iPhone 16 Pro" — add `os:` or `udid:`/,
        );
    });
});
