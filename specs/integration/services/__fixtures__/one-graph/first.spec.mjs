import { test } from 'vitest';

import { record } from './record.mjs';
import { subject } from './subject.specification.mjs';

test('records the subject it booted', () => {
    record('first', subject);
});
