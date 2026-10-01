import { materialAt, testPackageOf } from '@jterrazz/test/oxlint';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');

type MaterialReaders = { materialAt: typeof materialAt; testPackageOf: typeof testPackageOf };

function answersOf(readers: MaterialReaders): unknown[] {
    return [
        readers.materialAt(resolve(ROOT, 'src/index.test.ts')),
        readers.materialAt(resolve(ROOT, 'specs/_shared/_fixtures/api-app/app.ts')),
        readers.materialAt(resolve(ROOT, 'specs/_shared'), true),
        readers.materialAt(resolve(ROOT, 'src/index.ts')),
        readers.testPackageOf('vitest/config'),
        readers.testPackageOf('@testing-library/react'),
        readers.testPackageOf('@jterrazz/test/oxlint'),
        readers.testPackageOf('hono'),
    ];
}

describe('index.oxlint', () => {
    test('the ./oxlint entry — the ./oxlint entry publishes what test material is — both builds answer materialAt and testPackageOf, typed from the published declarations', () => {
        // Given - the entry as a consumer imports it, and its CommonJS build (`npm run build` first)
        // oxlint-disable-next-line typescript/no-unsafe-assignment -- `require` answers `any`: the ESM build's published types are the shape the CJS build must carry
        const cjs: MaterialReaders = createRequire(import.meta.url)('@jterrazz/test/oxlint');

        // Then - each build reads a module id and a specifier as the `no-test-code-in-production` guard does
        const answers = [
            'a test file',
            'the specs tree',
            'the specs tree',
            undefined,
            'vitest',
            '@testing-library/react',
            undefined,
            undefined,
        ];
        expect(answersOf({ materialAt, testPackageOf })).toStrictEqual(answers);
        expect(answersOf(cjs)).toStrictEqual(answers);
    });
});
