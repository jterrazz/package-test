import { expect, test } from 'vitest';

// Own-app source import — the documented pattern (F3 allows a consumer spec to
// reach its OWN app's src/, e.g. `server: () => createApp()`). Not a framework
// internal, so no diagnostic.
import { createApp } from '../../../src/app.js';

test('builds the app', () => {
    // Given - the consumer's own app factory
    const app = createApp();

    // Then - defined
    expect(app).toBeDefined();
});
