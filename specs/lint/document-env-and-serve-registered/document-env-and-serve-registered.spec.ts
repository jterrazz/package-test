import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint as checker } from '../checker-lint.specification.js';

describe('document-env-and-serve-registered', () => {
    test('rejects env and serve names no runner registers', async () => {
        // Given - a typo in both registries, beside a specification file that has neither
        const result = await checker
            .fixture(directory('./_fixtures/document-env-and-serve-registered/'))
            .run();

        // Then - the pass names the document, the line and what to write instead
        expect(result.report).toMatch(`
            specs/widget/builds.spec.yaml:3:1  jterrazz-check(document-env-and-serve-registered)
                found: env: "frozn", which no specification registers
                why: A document's bare \`env:\` words and \`serve:\` names are keys of the \`env\`/\`serve\` objects of a \`specification.cli(…)\` in the nearest directory carrying \`*.specification.ts\` files (literals read statically; ignored otherwise).
                fix: name one of frozen, or register "frozn" in \`specification.cli({ env })\`
                read: docs/19-linting.md#document-env-and-serve-registered
            specs/widget/builds.spec.yaml:5:1  jterrazz-check(document-env-and-serve-registered)
                found: serve: "dashbord", which no specification registers
                why: A document's bare \`env:\` words and \`serve:\` names are keys of the \`env\`/\`serve\` objects of a \`specification.cli(…)\` in the nearest directory carrying \`*.specification.ts\` files (literals read statically; ignored otherwise).
                fix: name one of api, or register "dashbord" in \`specification.cli({ serve })\`
                read: docs/19-linting.md#document-env-and-serve-registered
        `);
    });

    test('accepts a document that holds the convention', async () => {
        // Given - the compliant twin every document pass shares
        const result = await checker
            .fixture(directory('../../_shared/_fixtures/spec-document-ok/'))
            .run();

        // Then - the clean summary (0 warnings) on stdout
        expect(result.report).toMatch('');
    });
});
