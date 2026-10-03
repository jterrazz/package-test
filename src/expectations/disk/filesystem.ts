import { CaptureScope } from '../tokens/capture-scope.js';
import { walkDirectory } from './directory.js';

/** Read-only accessor for the working directory of a command spec. */
export class FilesystemAccessor {
    /** @internal */
    readonly captures: CaptureScope;
    /** The absolute path of the temporary working directory. */
    readonly cwd: string;
    /** @internal */
    readonly testDir: string;

    constructor(cwd: string, testDir: string, captures?: CaptureScope) {
        this.cwd = cwd;
        this.testDir = testDir;
        this.captures = captures ?? new CaptureScope();
    }

    /** List all files (recursively) under the working directory, sorted. */
    async files(options: { ignore?: string[] } = {}): Promise<string[]> {
        return await walkDirectory(this.cwd, options);
    }
}
