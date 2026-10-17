import { describe, expect, test } from 'vitest';

import { cli as transformCli } from '../transform-cli.specification.js';

/* invariant: the accessors and matchers are the subject here; the fixture CLI's output is the vehicle. */
/* oxlint-disable jterrazz/no-raw-bypass -- The raw `.raw` accessor IS the subject
   under test here (see the note above): every `.raw` assertion proves what the
   comparison strips. Whole-output goldens are the toMatch(file(...)) cases in this file. */

describe('transform', () => {
    test('the json accessor applies transform before JSON.parse', async () => {
        // Given - JSON output wrapped in ANSI codes
        const result = await transformCli.exec('ansi-json');

        // Then - raw stdout still has ANSI wrapping the JSON, which would NOT parse
        expect(result.stdout.raw).toContain('\u001B[32m');

        // Then - .json.value works because the transform stripped ANSI before parse
        expect(result.json).toMatch({ status: 'ok', value: 42 });
    });
});
