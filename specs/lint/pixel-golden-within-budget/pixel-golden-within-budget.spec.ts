import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('pixel-golden-within-budget', () => {
    test('goldens each within the cap, together within the budget, pass', async () => {
        // Given - two PNG goldens, one at the cap, in two __expected__/ folders
        const result = await checker
            .fixture(directory('./__fixtures__/within-budget/'))
            .run({ args: '--member .' });

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a PNG outside every __expected__/ is no golden, and is not judged', async () => {
        // Given - an asset past the cap, under no __expected__/
        const result = await checker
            .fixture(directory('./__fixtures__/outside-expected/'))
            .run({ args: '--member .' });

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a golden past its cap is refused at the image', async () => {
        // Given - one PNG golden of 120 bytes, under a cap of 100
        const result = await checker
            .fixture(directory('./__fixtures__/over-cap/'))
            .run({ args: '--member .' });

        // Then - the finding at the image, with its lesson
        expect(result.report).toMatch(`
            __expected__/panel.light.png:1:1  jterrazz-check(pixel-golden-within-budget)
                found: __expected__/panel.light.png weighs 120 bytes, past the cap of 100 per image
                why: A pixel golden is a curated, small file: every \`*.png\` under an \`__expected__/\` of the repository, at any depth and in any member, is judged by the run over the project root (a \`__fixtures__/\` tree is verbatim material, and is not entered; a PNG outside every \`__expected__/\` is no golden, and is not judged).
                fix: crop it to its subject and its shadow, re-encode it with the pinned lossless encoder, or let its view golden prove it
                read: docs/reference/linting.md#pixel-golden-within-budget
        `);
    });

    test('a golden in the __expected__/ of a Swift test target is judged like any', async () => {
        // Given - one PNG golden of 120 bytes beside a SwiftPM test target's sources, under a cap of 100
        const result = await checker
            .fixture(directory('./__fixtures__/swift-test-target/'))
            .run({ args: '--member .' });

        // Then - the finding at the image, with its lesson
        expect(result.report).toMatch(`
            apps/menubar/tests/station-kit-tests/__expected__/kit/panel.light.png:1:1  jterrazz-check(pixel-golden-within-budget)
                found: apps/menubar/tests/station-kit-tests/__expected__/kit/panel.light.png weighs 120 bytes, past the cap of 100 per image
                why: A pixel golden is a curated, small file: every \`*.png\` under an \`__expected__/\` of the repository, at any depth and in any member, is judged by the run over the project root (a \`__fixtures__/\` tree is verbatim material, and is not entered; a PNG outside every \`__expected__/\` is no golden, and is not judged).
                fix: crop it to its subject and its shadow, re-encode it with the pinned lossless encoder, or let its view golden prove it
                read: docs/reference/linting.md#pixel-golden-within-budget
        `);
    });

    test('goldens past the budget together are refused at the settings', async () => {
        // Given - two PNG goldens of 70 bytes, under a budget of 120
        const result = await checker
            .fixture(directory('./__fixtures__/over-budget/'))
            .run({ args: '--member .' });

        // Then - the finding at studio.config.ts, with its lesson
        expect(result.report).toMatch(`
            studio.config.ts:1:1  jterrazz-check(pixel-golden-within-budget)
                found: 140 bytes of PNG under __expected__/, past the budget of 120
                why: A pixel golden is a curated, small file: every \`*.png\` under an \`__expected__/\` of the repository, at any depth and in any member, is judged by the run over the project root (a \`__fixtures__/\` tree is verbatim material, and is not entered; a PNG outside every \`__expected__/\` is no golden, and is not judged).
                fix: keep the goldens a paint recipe needs, each cropped to its subject, and state the rest as view goldens
                read: docs/reference/linting.md#pixel-golden-within-budget
        `);
    });

    test('a recorded total above what the tree holds is a slack, refused at the entry', async () => {
        // Given - 500 bytes recorded, and one golden of 70
        const result = await checker
            .fixture(directory('./__fixtures__/slack/'))
            .run({ args: '--member .' });

        // Then - the finding at the entry, naming the gesture that lowers it
        expect(result.report).toMatch(`
            .studio/baseline.json:1:1  jterrazz-check(pixel-golden-within-budget)
                found: .studio/baseline.json › test › pixel-goldens/bytes records 500 bytes, and the tree holds 70
                why: A pixel golden is a curated, small file: every \`*.png\` under an \`__expected__/\` of the repository, at any depth and in any member, is judged by the run over the project root (a \`__fixtures__/\` tree is verbatim material, and is not entered; a PNG outside every \`__expected__/\` is no golden, and is not judged).
                fix: run 'typescript fix', which lowers the entry to 70
                read: docs/reference/linting.md#pixel-golden-within-budget
        `);
    });
});
