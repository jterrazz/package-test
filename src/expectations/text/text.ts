import { CaptureScope } from '../tokens/capture-scope.js';
import { stripAnsiCodes } from './ansi.js';
import { grep as grepBlocks } from './grep.js';

/** The captured text accessor: `.text` is what a golden compares (ANSI stripped, `transform` applied), `.raw` the capture. */
export class TextAccessor {
    /** @internal */
    readonly captures: CaptureScope;
    /** The stream as it was captured: never transformed, ANSI preserved. */
    readonly raw: string;
    /** @internal */
    readonly streamName: string;
    /** @internal */
    readonly testDir: string;
    /** Normaliser applied before comparisons, never to fixtures. @internal */
    readonly transform?: ((text: string) => string) | undefined;

    constructor(
        value: string,
        streamName: string,
        testDir: string,
        options: {
            captures?: CaptureScope | undefined;
            transform?: ((text: string) => string) | undefined;
        } = {},
    ) {
        this.raw = value;
        this.streamName = streamName;
        this.testDir = testDir;
        this.transform = options.transform;
        this.captures = options.captures ?? new CaptureScope();
    }

    /** The text a golden compares, and a value matcher reads: ANSI stripped, `transform` applied. */
    get text(): string {
        const stripped = stripAnsiCodes(this.raw);
        return this.transform ? this.transform(stripped) : stripped;
    }

    /** Keep only the blank-line-separated blocks containing `pattern`, as a new `TextAccessor`. */
    grep(pattern: string): TextAccessor {
        return new TextAccessor(grepBlocks(this.raw, pattern), this.streamName, this.testDir, {
            captures: this.captures,
            transform: this.transform,
        });
    }

    toString(): string {
        return this.text;
    }

    valueOf(): string {
        return this.text;
    }
}
