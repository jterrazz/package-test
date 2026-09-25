import type { BaseResult } from './result.js';

/**
 * What a triggered job HANDS BACK.
 *
 * A job writes to a database, a cache, a queue — never to a working directory
 * the spec then walks, because a job has none: it runs in this process, where
 * the only filesystem is the repository's. So the two accessors that read one
 * (`file()`, `directory()`) are not on this result. A pipeline that really
 * produces files is a binary, and `specification.cli()` is its facet.
 */
export type JobsResult = Omit<BaseResult, 'directory' | 'file'>;
