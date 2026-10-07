import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('one-describe-per-file', () => {
    test('one describe titled with the aspect holds every test', async () => {
        // Given - the aspect-title tree
        const result = await lint.fixture(directory('./__fixtures__/aspect-title/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test("a describe titled with anything but the file's aspect is refused at its title", async () => {
        // Given - the wrong-title tree
        const result = await lint.fixture(directory('./__fixtures__/wrong-title/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/events/list/pagination.spec.ts:5:10  jterrazz(one-describe-per-file)
                found: the file’s \`describe\` is titled "events listing"
                why: A test file — a \`.spec.ts\`, a \`.test.ts\`, a \`.test.tsx\` — holds one top-level \`describe\`, titled with what the file is about, and every test inside it.
                fix: title it 'pagination', the file's aspect — \`typescript fix\` renames it, keeping the title it said on each of its tests, unless it named this aspect in another spelling, when it holds tests alone and its title opens on no capital
                read: docs/reference/linting.md#one-describe-per-file
        `);
    });

    test('a spec whose tests stand in no describe is refused at its first test', async () => {
        // Given - the no-describe tree
        const result = await lint.fixture(directory('./__fixtures__/no-describe/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/events/list/pagination.spec.ts:5:1  jterrazz(one-describe-per-file)
                found: the tests of this file stand in no \`describe\`
                why: A test file — a \`.spec.ts\`, a \`.test.ts\`, a \`.test.tsx\` — holds one top-level \`describe\`, titled with what the file is about, and every test inside it.
                fix: wrap them in \`describe('pagination', () => { … })\` — \`typescript fix\` does it
                read: docs/reference/linting.md#one-describe-per-file
        `);
    });

    test("a colocated test titled with its module's role suffix is refused", async () => {
        // Given - the role-suffix tree
        const result = await lint.fixture(directory('./__fixtures__/role-suffix/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/__tests__/request.action.test.ts:5:10  jterrazz(one-describe-per-file)
                found: the file’s \`describe\` is titled "request.action"
                why: A test file — a \`.spec.ts\`, a \`.test.ts\`, a \`.test.tsx\` — holds one top-level \`describe\`, titled with what the file is about, and every test inside it.
                fix: title it 'request', the file's subject — \`typescript fix\` renames it, keeping the title it said on each of its tests, unless it named this subject in another spelling, when it holds tests alone and its title opens on no capital
                read: docs/reference/linting.md#one-describe-per-file
        `);
    });

    test('--fix carries a group title onto its tests once: a test already carrying it keeps its title as written', async () => {
        // Given - a file merged once under a describe titled with the function, renamed since
        const result = await lint
            .fixture(directory('./__fixtures__/merged-twice/'))
            .run({ fix: true });

        // Then - nothing is left to report, and no title carries the group twice
        expect(result.report).toMatch('');
        await expect(result.directory()).toMatch(directory('./__expected__/merged-twice/'));
    });

    test('--fix leaves a group titled with a capital to its author: the lowercase-title fix would rewrite the name it carries', async () => {
        // Given - a second describe titled with a SCREAMING_CASE constant
        const result = await lint
            .fixture(directory('./__fixtures__/constant-title/'))
            .run({ fix: true });

        // Then - no test carries the constant, in any case, and the finding stands, its lesson naming the capital
        const { content } = result.file('specs/api/articles/related/related.spec.ts');
        expect({
            group: content.includes("describe('ARTICLES_42_RELATED_INDICES'"),
            prefixed: /\bARTICLES_42_RELATED_INDICES — /iu.test(content),
        }).toStrictEqual({ group: true, prefixed: false });
        expect(result.report).toMatch(`
            specs/api/articles/related/related.spec.ts:15:1  jterrazz(one-describe-per-file)
                found: a second top-level \`describe\` in a file about one aspect
                why: A test file — a \`.spec.ts\`, a \`.test.ts\`, a \`.test.tsx\` — holds one top-level \`describe\`, titled with what the file is about, and every test inside it.
                fix: merge the groups under \`describe('related', …)\`, each test titled \`<group> — <test>\` unless the group named this aspect — \`typescript fix\` does it when every group holds tests alone and no title it carries opens on a capital — or move this one to a file of its own aspect
                read: docs/reference/linting.md#one-describe-per-file
        `);
    });
});
