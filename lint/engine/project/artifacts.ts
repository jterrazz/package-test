import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Every path here is relative to the project root. */
export const ARTIFACTS_DIR = '.artifacts';

export const VITEST_ARTIFACTS_DIR = `${ARTIFACTS_DIR}/vitest`;

export const COVERAGE_DIR = `${VITEST_ARTIFACTS_DIR}/coverage`;

export const SQLITE_TEMPLATE_DIR = `${VITEST_ARTIFACTS_DIR}/sqlite`;

/** Attachments and Browser Mode failure screenshots, which Vitest 5 would put in `.vitest/`. */
export const ATTACHMENTS_DIR = `${VITEST_ARTIFACTS_DIR}/attachments`;

/** Under the project: the run's temp root is gone by the time the error naming the file is read. */
export const EVIDENCE_DIR = `${VITEST_ARTIFACTS_DIR}/evidence`;

export function evidenceDirectory(prefix: string): string {
    const parent = resolve(EVIDENCE_DIR);
    mkdirSync(parent, { recursive: true });
    return join(parent, prefix);
}

export const SCREENSHOTS_DIR = `${VITEST_ARTIFACTS_DIR}/screenshots`;

export const BLOB_DIR = `${VITEST_ARTIFACTS_DIR}/blob`;

/** Vitest 5's file-writing reporters, each pinned under the artifacts folder. */
export const REPORTER_OUTPUT_FILES: Record<string, string> = {
    blob: `${BLOB_DIR}/blob.json`,
    html: `${VITEST_ARTIFACTS_DIR}/html/index.html`,
    json: `${VITEST_ARTIFACTS_DIR}/json/output.json`,
    junit: `${VITEST_ARTIFACTS_DIR}/junit/output.xml`,
};
