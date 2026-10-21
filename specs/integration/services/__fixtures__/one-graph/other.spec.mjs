import { test } from 'vitest';

import { other } from './other.specification.mjs';
import { record } from './record.mjs';

test('records the other subject it booted', () => {
    record('other', other);
});
