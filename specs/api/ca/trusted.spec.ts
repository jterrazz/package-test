import { describe, expect, test } from 'vitest';

import { specimen } from '../deployed.specification.js';
import { api as untrusted } from '../untrusted.specification.js';

describe('trusted', () => {
    test('a certificate a private authority signed is refused where that authority is not trusted', async () => {
        // Given - the deployed https api, from a specification that names no `ca`
        const result = await untrusted.get(`${specimen.secure}/health`);

        // Then - the chain reaches no authority the system trusts
        expect(result.response).toMatch('unreachable: tls UNABLE_TO_VERIFY_LEAF_SIGNATURE');
    });
});
