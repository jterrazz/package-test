import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../checker-cli.specification.js';

describe('section', () => {
    test('lint — checker CLI contract — `baseline` rewrites the test section and keeps the typescript section byte for byte', async () => {
        // Given - a family file holding both sections, the typescript one spelled on one line
        const result = await cli
            .fixture(directory('../__fixtures__/checker-ratchet/'))
            .exec('baseline .');

        // Then - the recorded debt is the tree's, and the other package's section is untouched
        expect(result.exitCode).toBe(0);
        expect(result.file('.jterrazz/baseline.json').content).toBe(
            '{\n    "typescript": { "eslint/complexity": 3 },\n    "test": {\n        "jterrazz-check/no-unused-ground": 1\n    }\n}\n',
        );
    });
});
