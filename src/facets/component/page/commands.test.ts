import { describe, expect, test } from 'vitest';

import { COMPONENT_COMMANDS } from './commands.js';

describe('the commands a page reaches the node side through', () => {
    test('the registered list is what the page can call, and nothing else', () => {
        // Given - the record `component()` hands to the browser project
        // Then - the things a page cannot do for itself are there
        expect(Object.keys(COMPONENT_COMMANDS).toSorted()).toStrictEqual([
            'ariaTree',
            'goldenRead',
            'goldenWrite',
            'inPlaceWrite',
        ]);
    });
});
