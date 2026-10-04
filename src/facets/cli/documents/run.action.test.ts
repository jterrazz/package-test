import { basename } from 'node:path';
import { describe, expect, test } from 'vitest';

import { readerOf } from '../../../chain/state.js';
import { file } from '../../../disk/spec-path.js';
import { run } from './run.action.js';

const READ = readerOf({ slices: {}, testDir: null });

describe('run', () => {
    test('run.action — preparing a document — lays it a scratch directory of its own, and refuses a file that is no document', async () => {
        // Given - a document, and a file of another kind
        const prepared = await run.prepare?.([file('./orders.spec.yaml')], READ);

        // Then - a fresh directory named for documents, and the refusal naming the extension
        expect(basename(prepared?.workDir ?? '').startsWith('spec-command-')).toBe(true);
        await expect(async () => {
            // @ts-expect-error -- a file of another kind: the type refuses it at every typed site
            await run.prepare?.([file('./orders.json')], READ);
        }).rejects.toThrow(
            /^found: run\(file\("\.\/orders\.json"\)\), a file not ending in \.spec\.yaml/u,
        );
    });
});
