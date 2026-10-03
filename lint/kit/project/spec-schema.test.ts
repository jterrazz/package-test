import { describe, expect, test } from 'vitest';

import { DOCUMENT_KEYS, RUN_KEYS } from './spec-grammar.js';
import { SPEC_SCHEMA } from './spec-schema.js';

describe('spec-schema', () => {
    test('the published schema describes exactly the keys the parser reads', () => {
        // Given - the schema shipped for editors
        // Then - its closed sets are the parser's own, so the two cannot drift
        expect(Object.keys(SPEC_SCHEMA.properties).toSorted()).toStrictEqual(
            [...DOCUMENT_KEYS].toSorted(),
        );
        expect(Object.keys(SPEC_SCHEMA.$defs.run.properties).toSorted()).toStrictEqual(
            [...RUN_KEYS].toSorted(),
        );
        expect(SPEC_SCHEMA.additionalProperties).toBe(false);
        expect(SPEC_SCHEMA.$defs.run.additionalProperties).toBe(false);
    });
});
