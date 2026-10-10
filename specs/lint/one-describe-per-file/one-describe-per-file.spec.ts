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
                fix: title it 'pagination', the file's aspect, or in the words of the file's name — 'cli reference' for \`cli-reference.spec.ts\`
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

    test("a colocated test titled with its module's file name is accepted: the file base spelled as it is written", async () => {
        // Given - the role-suffix tree, a test of `request.action.ts` whose describe says "request.action"
        const result = await lint.fixture(directory('./__fixtures__/role-suffix/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('--fix never renames a describe: a group titled with something else than the file is reported, and the tests keep their titles as written', async () => {
        // Given - a describe titled with the function in a file about the articles
        const result = await lint
            .fixture(directory('./__fixtures__/merged-twice/'))
            .run({ fix: true });

        // Then - the finding stands, and the file is its own golden
        expect(result.report).toMatch(`
            specs/api/articles/create/articles.spec.ts:5:10  jterrazz(one-describe-per-file)
                found: the file’s \`describe\` is titled "createArticle"
                why: A test file — a \`.spec.ts\`, a \`.test.ts\`, a \`.test.tsx\` — holds one top-level \`describe\`, titled with what the file is about, and every test inside it.
                fix: title it 'articles', the file's aspect, or in the words of the file's name — 'cli reference' for \`cli-reference.spec.ts\`
                read: docs/reference/linting.md#one-describe-per-file
        `);
        await expect(result.directory()).toMatch(directory('./__expected__/merged-twice/'));
    });

    test("--fix merges a group titled with a capital under the file's describe, every test keeping its title", async () => {
        // Given - a second describe titled with a SCREAMING_CASE constant, in a file about one aspect
        const result = await lint
            .fixture(directory('./__fixtures__/constant-title/'))
            .run({ fix: true });

        // Then - the group is gone, no test carries its title as a prefix, and nothing is left to report
        const { content } = result.file('specs/api/articles/related/related.spec.ts');
        expect({
            group: content.includes("describe('ARTICLES_42_RELATED_INDICES'"),
            prefixed: /\bARTICLES_42_RELATED_INDICES — /iu.test(content),
        }).toStrictEqual({ group: false, prefixed: false });
        expect(result.report).toMatch('');
    });
});
