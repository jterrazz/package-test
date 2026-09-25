import { describe, expect, test } from 'vitest';

import { file } from '../../model/chain/spec-path.js';
import { run } from './run.action.js';

/** A reader no setup of these runs is asked through. */
const unread = <Slice>(capability: { readonly initial: Slice }): Slice => capability.initial;

describe('.run() — the document a chain runs', () => {
    test('refuses a file that is not a .spec.yaml document', () => {
        // Given - a caller the compiler does not see, handing a file of another kind

        // Then - it is refused, naming the extension a document has
        // checker-disable-next-line c8 -- the refusal under test fires before the document is read: the path names nothing on purpose
        expect(() => run.prepare?.([file('./help.yaml') as never], unread)).toThrow(
            /a file not ending in \.spec\.yaml/u,
        );
    });
});
