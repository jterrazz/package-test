import { grep as grepUtil } from '../common/result/grep.js';
import { BaseResult } from '../common/result/result.js';
import type { SpecificationConfig } from '../specification-builder.js';
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

    /** The captured standard output. */
    get stdout(): string {
        return this.commandResult.stdout;
    }

    /** The captured standard error. */
    get stderr(): string {
        return this.commandResult.stderr;
    }

    /**
     * Extract text blocks from stdout that contain a pattern.
     *
     * @example
     *   expect(result.grep('error.ts')).toContain('no-unused-vars');
     */
    grep(pattern: string): string {
        return grepUtil(this.stdout, pattern);
    }
}
