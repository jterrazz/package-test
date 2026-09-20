/**
 * Where a tool writes what it generates: `.artifacts/<tool>/` at the project
 * root, one folder per tool (`dist/` is the ecosystem's single exception).
 *
 * The convention is estate-wide, so the paths are stated ONCE here and read by
 * everyone who writes: the vitest preset (`cacheDir`, coverage) and the sqlite
 * adapter (its schema template). A second copy of `.artifacts/vitest` would be
 * a second answer to "where does a run's cache live", and the day one moved the
 * other would keep writing to the old place.
 *
 * Every path is RELATIVE to the project root: a preset hands it to vite, which
 * resolves it against its own root; a runtime writer resolves it against the
 * root A9 discovered.
 */

/** The one artefact folder of a project. */
export const ARTIFACTS_DIR = '.artifacts';

/** Everything a vitest run generates. */
export const VITEST_ARTIFACTS_DIR = `${ARTIFACTS_DIR}/vitest`;

/** Where the coverage provider writes its report. */
export const COVERAGE_DIR = `${VITEST_ARTIFACTS_DIR}/coverage`;

/** Where `sqlite()` caches the schema template it copies per worker. */
export const SQLITE_TEMPLATE_DIR = `${VITEST_ARTIFACTS_DIR}/sqlite`;

/**
 * Where `context.annotate()` puts what a test attaches, and where Browser Mode
 * drops a failure screenshot. Vitest 5 defaults both to `.vitest/` at the
 * repository ROOT — a second artefact folder beside the one the estate declares,
 * and one no `.gitignore` rule of ours covers.
 */
export const ATTACHMENTS_DIR = `${VITEST_ARTIFACTS_DIR}/attachments`;

/** Where the browser provider drops a screenshot of a failing test. */
export const SCREENSHOTS_DIR = `${VITEST_ARTIFACTS_DIR}/screenshots`;

/**
 * What each file-writing reporter writes, by reporter name.
 *
 * Vitest 5 turned the json and junit reporters into FILE writers (they printed
 * to stdout before) and gave the html and blob ones a `.vitest/` home. Each one
 * is a path the tool pins and a consumer never states, so the preset moves all
 * four at once rather than leaving a repository to discover them one CI run at
 * a time.
 */
export const REPORTER_OUTPUT_FILES: Record<string, string> = {
    blob: `${VITEST_ARTIFACTS_DIR}/blob`,
    html: `${VITEST_ARTIFACTS_DIR}/html/index.html`,
    json: `${VITEST_ARTIFACTS_DIR}/json/output.json`,
    junit: `${VITEST_ARTIFACTS_DIR}/junit/output.xml`,
};
