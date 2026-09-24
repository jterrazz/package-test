import type { ScriptedApp } from '../appium-double/app.js';

/**
 * The simulator Specimen runs on: the one the runner asks the server for,
 * and the one `make test-mobile` installs the app on.
 */
export const simulator = { name: 'iPhone 17', os: '26.5' };

/**
 * Specimen — the native app the mobile specs drive, described as data.
 *
 * The protocol double draws it in `make check`; `ios/` is the same app in
 * SwiftUI, installed on a simulator by `make test-mobile`
 * (`on-simulator.mjs`). The two are kept screen for screen: a spec that
 * passes on one and fails on the other has found a gap between the double
 * and a device.
 */
export const specimen: ScriptedApp = {
    bundleId: 'com.jterrazz.specimen',
    launch: 'home',
    name: 'Specimen',
    scheme: 'specimen',
    screens: {
        drafts: [
            { label: 'Drafts', type: 'StaticText' },
            {
                children: [
                    { label: 'Groceries', type: 'StaticText' },
                    { label: 'Delete', tap: 'draft-deleted', type: 'Button' },
                ],
                identifier: 'draft-row',
                type: 'Other',
            },
            {
                children: [
                    { label: 'Old list', type: 'StaticText' },
                    { label: 'Delete', tap: 'archive-deleted', type: 'Button' },
                ],
                identifier: 'archive-row',
                type: 'Other',
            },
            { label: 'Load older drafts', offscreen: true, tap: 'older', type: 'Button' },
        ],
        'archive-deleted': [{ label: 'Archived list deleted', type: 'StaticText' }],
        'draft-deleted': [{ label: 'Draft deleted', type: 'StaticText' }],
        home: [
            { label: 'Welcome to Specimen', type: 'StaticText' },
            { label: 'Sign in', tap: 'sign-in', type: 'Button' },
        ],
        notes: [
            { label: 'Notes', type: 'StaticText' },
            {
                identifier: 'note-list',
                rows: { failure: 'Notes unavailable', field: 'title', path: '/notes' },
                type: 'Other',
            },
        ],
        older: [{ label: 'No older drafts', type: 'StaticText' }],
        'sign-in': [
            { label: 'Sign in', type: 'StaticText' },
            { identifier: 'email', label: 'Email', type: 'TextField', value: 'name@example.com' },
            { identifier: 'password', label: 'Password', type: 'SecureTextField', value: 'Required' },
            { label: 'Continue', tap: 'signed-in', type: 'Button' },
        ],
        'signed-in': [
            { label: 'Signed in as {email}', type: 'StaticText' },
            { label: 'Sign out', tap: 'home', type: 'Button' },
        ],
    },
};
