import type { SpecificationConfig } from '../../builder.js';
import { FilesystemAccessor } from '../../result/filesystem.js';
import { grep as grepUtil } from '../../result/grep.js';
import { JsonAccessor } from '../../result/json.js';
import { BaseResult } from '../../result/result.js';
import { StreamAccessor } from '../../result/stream.js';
import type { CommandResult } from './command.port.js';

/** Result from a CLI action (.exec(), .spawn()). */
export class CliResult extends BaseResult {
    private commandResult: CommandResult;

    constructor(options: {
        commandResult: CommandResult;
        config: SpecificationConfig;
        testDir: string;
        workDir: string;
    }) {
        super(options);
        this.commandResult = options.commandResult;
    }

    /** The process exit code. */
    get exitCode(): number {
        return this.commandResult.exitCode;
    }

    /** Accessor for the captured standard output with file-based assertions. */
    get stdout(): StreamAccessor {
        return new StreamAccessor(this.commandResult.stdout, 'stdout', this.testDir);
    }

    /** Accessor for the captured standard error with file-based assertions. */
    get stderr(): StreamAccessor {
        return new StreamAccessor(this.commandResult.stderr, 'stderr', this.testDir);
    }

    /** Accessor for parsing stdout as JSON and asserting against JSON fixtures. */
    get json(): JsonAccessor {
        return new JsonAccessor(this.commandResult.stdout, this.testDir);
    }

    /** Accessor for the temporary working directory the command ran in. */
    get filesystem(): FilesystemAccessor {
        if (!this.workDir) {
            throw new Error('CliResult.filesystem requires a working directory');
        }
        return new FilesystemAccessor(this.workDir, this.testDir);
    }

    /**
     * Extract text blocks from stdout that contain a pattern.
     *
     * @example
     *   expect(result.grep('error.ts')).toContain('no-unused-vars');
     */
    grep(pattern: string): string {
        return grepUtil(this.commandResult.stdout, pattern);
    }
}
