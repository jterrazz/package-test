import type { BaseResult } from '../../expectations/result.js';

/** What a triggered job hands back; a job has no working directory, so no `file()` or `directory()`. */
export type JobResult = Omit<BaseResult, 'directory' | 'file'>;
