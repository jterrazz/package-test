import { describe, expect, test } from 'vitest';

// Own-app source import — the documented pattern (`no-framework-internals` allows a consumer spec to
// reach its OWN app's src/, e.g. `server: () => createApp()`). Not a framework
// internal, so no diagnostic.
import { createApp } from '../../../src/app.js';

describe('widget', () => {
test('builds the app', () => { // oxlint-disable-line jterrazz/no-existence-only-assertion -- an input tree of the no-framework-internals spec: this rule is incidental to the one it feeds
    // Given - the consumer's own app factory
    const app = createApp();

    // Then - defined
    expect(app).toBeDefined();
});
});
