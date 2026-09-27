import { describe, expect, test } from 'vitest';

import { located, ROOT, treeOf } from '../../engine/testing/source.fixtures.js';
import { checkErrorIsARefusalOrAnInvariant } from './error-is-a-refusal-or-an-invariant.js';

const CHAPTER = '# 05\n\n### Time\n';

const REFUSED = `import { refusal } from '../../lint/index.refusal.js';

export function pinned(): never {
    throw new Error(refusal({ fix: 'f', found: 'x', read: 'docs/05-module-tests.md#time', why: 'w' }));
}

export function stack(): string | undefined {
    const { stack } = new Error('the call site');
    return stack ?? new Error('the call site').stack;
}

export function either(pinned: boolean, failure: Lesson): never {
    if (pinned) {
        throw new Error(refusal(failure));
    }
    throw new Error(
        refusal(
            pinned
                ? { fix: 'f', found: 'x', read: 'docs/05-module-tests.md#time', why: 'w' }
                : { fix: 'f', found: 'y', read: 'docs/05-module-tests.md#time', why: 'w' },
        ),
    );
}
`;

const HAND_WRITTEN = `export function pinned(read: string): never {
    if (read === '') {
        throw new TypeError('clock.at(): not an instant');
    }
    throw new Error(refusal({ fix: 'f', found: 'x', read, why: 'w' }));
}

export const stale = 'docs/05-module-tests.md#clock';

class ClockError extends Error {}
class PinError extends ClockError {}

export function subclassed(read: string, pinned: boolean): never {
    if (pinned) {
        throw new PinError('pinned twice');
    }
    if (read === '') {
        throw Error('clock.at(): no instant');
    }
    throw new Error(
        refusal(
            pinned
                ? { fix: 'f', found: 'x', why: 'w' }
                : { fix: 'f', found: 'y', read: read === 'x' ? 'docs/05-module-tests.md#time' : read, why: 'w' },
        ),
    );
}
`;

describe('checkErrorIsARefusalOrAnInvariant', () => {
    test('error-is-a-refusal-or-an-invariant — an error is a refusal reading a heading that exists, an invariant, or a stack read', () => {
        // Given - the package's own tree, and one with refusals (a lesson passed by name, a conditional lesson), an invariant and stack reads, beside one with hand-written messages (a built-in, a subclass of a subclass, a bare call) and broken reads (a lesson with none, a conditional read falling back on a variable)
        const declared = treeOf({
            'docs/05-module-tests.md': CHAPTER,
            'src/world/clock/clock.ts': REFUSED,
        });
        const drifted = treeOf({
            'docs/05-module-tests.md': CHAPTER,
            'src/world/clock/clock.ts': HAND_WRITTEN,
        });

        // Then - the package and the declared tree hold none; each drift is named where it stands
        expect(checkErrorIsARefusalOrAnInvariant(ROOT)).toStrictEqual([]);
        expect(checkErrorIsARefusalOrAnInvariant(declared)).toStrictEqual([]);
        expect(located(checkErrorIsARefusalOrAnInvariant(drifted))).toStrictEqual([
            'src/world/clock/clock.ts:3:15 error-is-a-refusal-or-an-invariant: `new TypeError(…)` carries a message written by hand',
            'src/world/clock/clock.ts:5:53 error-is-a-refusal-or-an-invariant: the refusal reads no chapter written in place',
            'src/world/clock/clock.ts:8:22 error-is-a-refusal-or-an-invariant: `docs/05-module-tests.md#clock` names a heading no chapter has',
            'src/world/clock/clock.ts:15:15 error-is-a-refusal-or-an-invariant: `new PinError(…)` carries a message written by hand',
            'src/world/clock/clock.ts:18:15 error-is-a-refusal-or-an-invariant: `Error(…)` carries a message written by hand',
            'src/world/clock/clock.ts:23:19 error-is-a-refusal-or-an-invariant: the refusal reads no chapter written in place',
            'src/world/clock/clock.ts:24:97 error-is-a-refusal-or-an-invariant: the refusal reads no chapter written in place',
        ]);
    });
});
