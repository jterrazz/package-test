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
`;

const HAND_WRITTEN = `export function pinned(read: string): never {
    if (read === '') {
        throw new TypeError('clock.at(): not an instant');
    }
    throw new Error(refusal({ fix: 'f', found: 'x', read, why: 'w' }));
}

export const stale = 'docs/05-module-tests.md#clock';
`;

describe('checkErrorIsARefusalOrAnInvariant', () => {
    test('error-is-a-refusal-or-an-invariant — an error is a refusal reading a heading that exists, an invariant, or a stack read', () => {
        // Given - the package's own tree, and one with a refusal, an invariant and stack reads beside one with a hand-written message and two broken reads
        const declared = treeOf({
            'docs/05-module-tests.md': CHAPTER,
            'src/kernel/refusals/invariant.ts':
                'export const invariant = (broken: string): Error => new Error(broken);\n',
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
        ]);
    });
});
