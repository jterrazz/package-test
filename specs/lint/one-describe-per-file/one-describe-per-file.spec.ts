import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('one-describe-per-file', () => {
    test('one describe titled with the aspect holds every test', async () => {
        // Given - the aspect-title tree
        const result = await lint.fixture(directory('./_fixtures/aspect-title/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test("a describe titled with anything but the file's aspect is refused at its title", async () => {
        // Given - the wrong-title tree
        const result = await lint.fixture(directory('./_fixtures/wrong-title/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/events/list/pagination.spec.ts:5:10  jterrazz(one-describe-per-file)
                found: the file’s \`describe\` is titled "events listing"
                why: A test file — a \`.spec.ts\`, a \`.test.ts\`, a \`.test.tsx\` — holds one top-level \`describe\`, titled with what the file is about, and every test inside it.
                fix: title it 'pagination', the file's aspect — \`typescript fix\` renames it, keeping the title it said on each of its tests when it holds tests alone
                read: docs/reference/linting.md#one-describe-per-file
        `);
    });

    test('a spec whose tests stand in no describe is refused at its first test', async () => {
        // Given - the no-describe tree
        const result = await lint.fixture(directory('./_fixtures/no-describe/')).run();

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
        const result = await lint.fixture(directory('./_fixtures/role-suffix/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/request.action.test.ts:5:10  jterrazz(one-describe-per-file)
                found: the file’s \`describe\` is titled "request.action"
                why: A test file — a \`.spec.ts\`, a \`.test.ts\`, a \`.test.tsx\` — holds one top-level \`describe\`, titled with what the file is about, and every test inside it.
                fix: title it 'request', the file's subject — \`typescript fix\` renames it, keeping the title it said on each of its tests when it holds tests alone
                read: docs/reference/linting.md#one-describe-per-file
        `);
    });
});
