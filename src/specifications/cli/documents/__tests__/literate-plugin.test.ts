import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { SpecSyntaxError } from '../../../../../lint/kit/project/spec-grammar.js';
import { literate } from '../literate-plugin.js';

const DOCUMENT = 'description: builds the app\nruns:\n    - command: build\n      exit: 0\n';

function moduleOf(specification: string, description = 'builds the app'): string {
    return [
        "import { test } from 'vitest';",
        `import { cli } from ${JSON.stringify(specification)};`,
        '',
        `test(${JSON.stringify(description)}, async () => {`,
        `    await cli.run({ [Symbol.for("@jterrazz/test:disk")]: 'file', path: "./orders.spec.yaml" });`,
        '});',
        '',
    ].join('\n');
}

function causeOf(work: () => unknown): unknown {
    try {
        work();
        return undefined;
    } catch (error) {
        return error instanceof Error ? error.cause : undefined;
    }
}

function documentIn(content: string): string {
    const root = mkdtempSync(join(tmpdir(), 'literate-'));
    writeFileSync(join(root, 'orders.spec.yaml'), content);
    return root;
}

describe('literate-plugin', () => {
    test('literate — the plugin — runs before the other loaders, and adds every document to the include unless told which', () => {
        // Given - a plugin stated with no include, and one with its own
        const plain = literate({ runner: './cli.specification.ts' });
        const narrowed = literate({ include: ['docs/*.spec.yaml'], runner: './s.ts' });

        // Then - its identity, and the include each adds
        expect([plain.name, plain.enforce, plain.config(), narrowed.config()]).toStrictEqual([
            'jterrazz-test:literate',
            'pre',
            { test: { include: ['**/*.spec.yaml'] } },
            { test: { include: ['docs/*.spec.yaml'] } },
        ]);
    });

    test('literate — the plugin — loads a document as a test calling the specification, resolved against the root vite hands it, a query dropped', () => {
        // Given - a document in a root, and plugins over a relative and an absolute specification
        const root = documentIn(DOCUMENT);
        const relative = literate({ runner: './cli.specification.ts' });
        const absolute = literate({ runner: '/specs/cli.specification.ts' });
        relative.configResolved({ root });
        const document = join(root, 'orders.spec.yaml');

        // Then - each document loaded as its module, and any other file left to the next loader
        expect([
            relative.load(`${document}?import`),
            absolute.load(document),
            relative.load(join(root, 'orders.spec.ts')),
            relative.load(`${document}.bak`),
        ]).toStrictEqual([
            moduleOf(join(root, 'cli.specification.ts')),
            moduleOf('/specs/cli.specification.ts'),
            null,
            null,
        ]);
    });

    test("literate — the plugin — refuses a document off its grammar, naming the line and keeping the parser's reason", () => {
        // Given - a document whose run has no exit
        const root = documentIn('description: builds\nruns:\n    - command: build\n');
        const plugin = literate({ runner: '/s.ts' });

        // Then - the refusal names the document's line, and carries the syntax error as its cause
        const document = join(root, 'orders.spec.yaml');
        const loading = (): unknown => plugin.load(document);
        expect(loading).toThrow(
            new Error(
                [
                    `found: ${document}:3: a run is missing "exit:": command and exit are mandatory`,
                    'why: A spec document follows one grammar, read by the parser the runner and the linter share: closed keys, `description:` and `runs:` required, `command:` and `exit:` in every run.',
                    'fix: write the key the grammar names; the reason prints the accepted set',
                    'read: docs/reference/linting.md#document-follows-its-grammar',
                ].join('\n'),
            ),
        );
        expect(causeOf(loading)).toBeInstanceOf(SpecSyntaxError);
    });
});
