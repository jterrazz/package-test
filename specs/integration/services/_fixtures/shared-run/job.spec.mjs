import { writeFileSync } from 'node:fs';
import { inject, test } from 'vitest';

test('the job project records the run services it was provided', () => {
    writeFileSync('job.url', inject('serviceContainers'));
});
