import { text } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { report } from './report.js';

describe('report', () => {
test('reports the total', () => {
    // Given - the report of two rows
    // Then - it matches its golden, beside the module
    expect(text(report())).toMatch('total.json');
});
});
