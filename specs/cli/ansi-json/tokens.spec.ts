import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

describe('tokens', () => {
    test('json accessor parses through ANSI noise without a transform', async () => {
        // Given - JSON wrapped in ANSI codes
        const result = await cli
            .fixture(directory('../../shared/fixtures/specimen-cli/'))
            .exec('ansi-json');

        // Then - parsing works because ANSI is stripped by default
        expect(result.json).toMatch({ status: 'ok', value: 42 });
    });
});
