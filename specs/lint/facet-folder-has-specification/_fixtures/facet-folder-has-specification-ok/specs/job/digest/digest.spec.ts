import { describe, expect, test } from 'vitest'; // checker-disable-line spec-in-subject-folder -- an input of facet-folder-has-specification: this folder is the case the rule reads, not a subject's standard name

import { job } from '../job.specification.js';

describe('digest', () => {
test('sends the digest', async () => {
    // Given - the digest job triggered by name
    const result = await job.trigger('send-digest');
    // Then - the run left the rows it wrote
    await expect(result.table('emails')).toMatch([['reader@site.test']]);
});
});
