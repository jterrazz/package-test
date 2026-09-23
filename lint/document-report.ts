import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { documentData, isFixture, specDocuments } from './schema-documents.js';

/** Is this an object a property can safely be read off? */
function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object';
}

/** The `runs` a document's parsed data holds, or none past a shape the schema would already refuse. */
function runsOf(data: unknown): unknown[] {
    return isRecord(data) && Array.isArray(data.runs) ? data.runs : [];
}

/** Does this run assert a failing exit with neither `stdout:` nor `stderr:` golden? */
function isSilentFailure(run: unknown): boolean {
    return isRecord(run) && run.exit !== 0 && run.stdout === undefined && run.stderr === undefined;
}

/**
 * Every lint-rule document — under `specs/lint/`, less the fixtures another
 * document feeds a violation through — that asserts a failing exit with
 * neither `stdout:` nor `stderr:` golden: an exit code proves A rule ended
 * the run, never WHICH one, so a document that only pins it keeps passing
 * once the wrong rule starts firing for the wrong reason.
 */
export function silentLintFailures(root: string): string[] {
    return specDocuments(root)
        .filter((file) => file.startsWith('specs/lint/') && !isFixture(file))
        .filter((file) => {
            const data = documentData(readFileSync(resolve(root, file), 'utf8'));
            return runsOf(data).some(isSilentFailure);
        });
}
