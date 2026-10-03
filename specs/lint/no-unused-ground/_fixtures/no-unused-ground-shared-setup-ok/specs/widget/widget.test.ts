import { describe, expect, test } from 'vitest';

import { appDirectory } from '../_shared/_setup/apps.js';

describe('widget', () => {
    test('stands on the shared app', () => {
        // Given - the app the shared setup names
        const directory = appDirectory();

        // Then - it is the shared fixture
        expect(directory).toContain('_fixtures/app');
    });
});
