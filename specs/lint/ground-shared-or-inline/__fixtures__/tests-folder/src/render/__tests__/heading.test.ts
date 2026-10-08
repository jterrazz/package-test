import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { heading } from '../heading.js';

describe('heading', () => {
    test('names its level', () => {
        // Then - the tree a reader hears
        expect(heading('Notes')).toMatch(file('./__expected__/notes.aria.txt'));
    });
});
