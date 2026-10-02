import { process as processService } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { integration } from '../pure.specification.js';

describe('process', () => {
    test("a process's url read before it is ready is refused, naming where the started one is read", async () => {
        // Given - a process declared and never started, its url read by the module under test
        const declared = processService({ command: 'node server.mjs', ready: /listening/u });
        const result = await integration.call(() => declared.url);

        // Then - the call threw the refusal, rather than handing the module an address nothing serves
        expect(result.error.text).toBe(
            [
                'found: process().url read before the process was ready',
                'why: A process’s URL is known once it is ready.',
                'fix: read it from the started services record — `env: (services) => …` or `server: (services) => …` — never at declaration time',
                'read: docs/18-services.md#process--the-one-shape-an-external-process-takes',
            ].join('\n'),
        );
    });
});
