import { describe, expect, test } from 'vitest';

import { appDirectory } from '../__setup__/apps.js';

describe('gadget', () => {
    test('stands on the shared app', () => {
        // Given - the app the shared setup names
        const directory = appDirectory();

        // Then - it is the shared fixture
        expect(directory).toContain('__fixtures__/app');
    });
});
