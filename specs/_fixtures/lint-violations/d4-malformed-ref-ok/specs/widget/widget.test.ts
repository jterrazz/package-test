import { describe, expect, test } from 'vitest';

import { cli } from '../../setup/widget.specification.js';

describe('widget', () => {
    test('matches the expected snapshot', async () => {
        // Given - a run producing output
        const result = await cli.exec('build');

        // Then - it matches the recorded fixture
        expect(result.stdout).toMatch('out.txt');
    });
});
