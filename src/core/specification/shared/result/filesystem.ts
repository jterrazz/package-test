import { CaptureScope } from '../../../matching/match.js';
import { walkDirectory } from './directory.js';

/**
 * Read-only accessor for the whole temporary working directory used by a
 * command spec.
 *
 * Assertions go through `expect()` (async — they walk the disk):
 * `await expect(result.filesystem).toMatch('scaffolded')` compares the
 * tree against the fixture directory `expected/<name>/`.
 */
export class FilesystemAccessor {
    /** @internal Ref-capture scope shared by the current spec execution. */
    readonly captures: CaptureScope;
    /** The absolute path of the temporary working directory. */
    readonly cwd: string;
    /** @internal Test-file directory — fixture resolution root for matchers. */
    readonly testDir: string;

    constructor(cwd: string, testDir: string, captures?: CaptureScope) {
        this.cwd = cwd;
        this.testDir = testDir;
        this.captures = captures ?? new CaptureScope();
    }

    /** List all files (recursively) under the working directory, sorted. */
    async files(options: { ignore?: string[] } = {}): Promise<string[]> {
        return walkDirectory(this.cwd, options);
    }
}
