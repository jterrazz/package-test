import { file } from '@jterrazz/test'; // checker-disable-line spec-in-subject-folder -- an input of no-reach-into-sibling-ground: this folder is the case the rule reads, not a subject's standard name
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('listed-over-the-catalog', () => {
test("orders are listed over the shared catalog and this leaf's delta", async () => {
    // Given - the seeds it stands on
    const result = await api
        .seed(file('../_seeds/catalog.sql'))
        .seed(file('./_seeds/delta.sql')) // checker-disable-line ground-shared-or-inline -- an input tree of the no-reach-into-sibling-ground spec: its file form is what the rule reads
        .get('/orders');

    // Then - the app answered
    expect(result.status).toBe(200);
});
});
