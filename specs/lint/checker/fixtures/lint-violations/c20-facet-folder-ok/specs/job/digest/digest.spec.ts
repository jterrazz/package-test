import { expect, test } from 'vitest'; // checker-disable-line c30 -- an input of C20: this folder is the case the rule reads, not a subject's standard name

import { job } from '../job.specification.js';

test('sends the digest', async () => {
    // Given - the digest job triggered by name
    const result = await job.trigger('send-digest');
    // Then - the run left the rows it wrote
    expect(result.table('emails')).toMatchRows([{ to: 'reader@site.test' }]); // oxlint-disable-line jterrazz/d20-whole-result -- an input tree of the checker spec: the probe is incidental to the rule it feeds
});
