import { writeFileSync } from 'node:fs';
import { inject, test } from 'vitest';

test('the integration project records the run services it was provided', () => {
    writeFileSync('integration.url', inject('serviceContainers'));
});
