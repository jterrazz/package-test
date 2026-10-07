import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('version', () => {
    test('prints the version of the widget', async () => {
        // Given - the widget command

        // When - its version is asked for
        const result = await cli.exec('widget --version');

        // Then - it prints the version alone
        expect(result.stdout).toMatch('1.0.0');
    });
});
