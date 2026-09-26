import { describe, expect, test } from 'vitest';

import { file } from '../../../kernel/files/spec-path.js';
import { run } from './run.action.js';

const unread = <Slice>(capability: { readonly initial: Slice }): Slice => capability.initial;

describe('run', () => {
    test('.run() — the document a chain runs — refuses a file that is not a .spec.yaml document', async () => {
        // Given - a caller the compiler does not see, handing a file of another kind

        // Then - it is refused, naming the extension a document has
        await expect(
            // checker-disable-next-line named-path-exists -- the refusal under test fires before the document is read: the path names nothing on purpose
            async () => await run.prepare?.([file('./help.yaml') as never], unread),
        ).rejects.toThrow(/a file not ending in \.spec\.yaml/u);
    });
});
