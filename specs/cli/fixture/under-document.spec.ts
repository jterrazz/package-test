import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

describe('under-document', () => {
    test("a chained .fixture() lies under a document's fixture:", async () => {
        // Given - a chain laying two files, and a document laying one of them again
        const result = await cli
            .fixture(directory('./_fixtures/chain-ground/'))
            .run(file('./under-document.spec.yaml'));

        // Then - the document's run saw the chain's own file, and the document's content where both lay one
        expect(result.exitCode).toBe(0);
    });
});
