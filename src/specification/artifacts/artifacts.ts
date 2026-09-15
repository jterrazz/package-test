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
