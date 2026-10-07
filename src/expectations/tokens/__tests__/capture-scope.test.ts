import { describe, expect, test } from 'vitest';

import { CaptureScope } from '../capture-scope.js';

describe('CaptureScope', () => {
    test('capture scope — a fork holds its captures apart until the scope adopts them', () => {
        // Given - a scope holding one capture, and a fork that records a second
        const scope = new CaptureScope('/tmp/spec-abc');
        scope.set('first', 1);
        const fork = scope.fork();
        fork.set('second', 2);

        // Then - the fork carries the scope's capture and its workdir, the scope not the fork's until it adopts them
        expect([fork.get('first'), fork.workdir, scope.has('second')]).toStrictEqual([
            1,
            '/tmp/spec-abc',
            false,
        ]);
        scope.adopt(fork);
        expect(scope.get('second')).toBe(2);
    });
});
