import { content } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { mobile } from '../mobile.specification.js';

describe('actions', () => {
    test('a verb refuses once the declared action budget is spent', async () => {
        // Given - a scenario waiting for text the launch screen never draws
        const opened = mobile.open(undefined, async (visitor) => {
            await visitor.see(content('Never drawn'));
        });

        // Then - the refusal names the runner's five seconds, and what was on screen instead
        await expect(opened).rejects.toThrow(
            /see\(content\("Never drawn"\)\) timed out after 5000ms — no visible match\.\nCurrently on screen: .*Welcome to Specimen/u,
        );
    });
});
