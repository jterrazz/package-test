import { expect, test } from 'vitest';

import { jobs } from '../jobs.specification.js';

test('sends the digest', async () => {
    // Given - the digest job triggered by name
    const result = await jobs.trigger('send-digest');
    // Then - the run left the rows it wrote
    expect(result.table('emails')).toMatchRows([{ to: 'reader@site.test' }]);
});
