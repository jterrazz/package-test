import { describe, expect, test } from 'vitest';

import { specimen } from '../deployment.specification.js';
import { deployment as strict } from '../strict.specification.js';

describe('trusted', () => {
    test('a certificate a private authority signed is refused where that authority is not trusted', async () => {
        // Given - the https deployment, from a specification that names no `ca`
        const result = await strict.get(`${specimen.secure}/health`);

        // Then - the chain reaches no authority the system trusts
        expect(result.response).toMatch('unreachable: tls UNABLE_TO_VERIFY_LEAF_SIGNATURE');
    });
});
