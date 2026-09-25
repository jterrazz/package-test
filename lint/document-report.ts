import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { documentData, isFixture, specDocuments } from './schema-documents.js';

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object';
}

function runsOf(data: unknown): unknown[] {
    return isRecord(data) && Array.isArray(data.runs) ? data.runs : [];
}

function isSilentFailure(run: unknown): boolean {
    return isRecord(run) && run.exit !== 0 && run.stdout === undefined && run.stderr === undefined;
}

/** An exit code proves a rule ended the run, never which one. */
export function silentLintFailures(root: string): string[] {
    return specDocuments(root)
        .filter((file) => file.startsWith('specs/lint/') && !isFixture(file))
        .filter((file) => {
            const data = documentData(readFileSync(resolve(root, file), 'utf8'));
            return runsOf(data).some(isSilentFailure);
        });
}
