import { describe, expect, test } from 'vitest';

import { startWebsite } from './start-website.js';

describe('startWebsite guards', () => {
    test('rejects when neither server nor url is given', async () => {
        // Given - empty options
        // Then - the xor guard names both choices
        await expect(startWebsite({})).rejects.toThrow(
            'exactly one of `server` (start the site locally) or `url` (target a running site)',
        );
    });

    test('rejects when both server and url are given', async () => {
        // Given - conflicting options
        // Then - the xor guard fires before anything starts
        await expect(
            startWebsite({ server: { command: 'node app.mjs' }, url: 'http://localhost:3000' }),
        ).rejects.toThrow('exactly one of');
    });
});
