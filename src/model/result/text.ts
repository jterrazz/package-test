import { CaptureScope } from '../matching/match.js';
import { grep as grepBlocks } from './grep.js';

// oxlint-disable-next-line no-control-regex -- the ANSI escape IS the control character: stripping it is the point
const ANSI_RE = /\u001B\[[0-9;]*m/gu;

/** Strip ANSI escape sequences from a string. */
export function stripAnsiCodes(value: string): string {
    return value.replace(ANSI_RE, '');
}

/**
 * Read-only accessor for a captured text handle — THE universal one: stdout,
 * stderr, container logs, and file text all surface as a `TextAccessor`.
 *
 * `.text` is the COMPARABLE text — ANSI escape sequences stripped (CONVENTIONS
 * D6), the runner's `transform` applied — the same text a golden compares, so
 * a stream compared as a value reads exactly what its golden would:
 * `expect(result.stdout.text).toContain('built')`. `.raw` is the stream as it
 * was captured. `toString()` / `valueOf()` give `.text`, so `String(stream)`
 * and template-literal interpolation read what a reader means.
 *
 * Text operations are **closed** over the type: `.grep(pattern)` returns a
 * `TextAccessor` (not a bare string), preserving the `expected/`-resolution
 * context and the `transform`, so results are chainable
 * (`result.stdout.grep(a).grep(b)`) and snapshot-able
 * (`expect(result.stdout.grep('users.ts')).toMatch(file('./expected/block.txt'))`).
 *
 * Its matchers are vitest's on `.text`, and the golden half of `toMatch` on
 * the accessor itself: `expect(result.stdout).toMatch(file('./expected/help.txt'))`
 * (with `{{token}}` support, CONVENTIONS D4).
 */
export class TextAccessor {
    /** @internal Ref-capture scope shared by the current spec execution. */
    readonly captures: CaptureScope;
    /** The stream as it was captured: never transformed, ANSI preserved. */
    readonly raw: string;
    /** @internal Stream label used in failure messages ("stdout" / "stderr"). */
    readonly streamName: string;
    /** @internal Test-file directory — fixture resolution root for matchers. */
    readonly testDir: string;
    /** @internal Normaliser applied before comparisons, never to fixtures. */
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

    /**
     * Keep only the blank-line-separated blocks of the text that contain
     * `pattern` (how linter/compiler output is structured), returned as a new
     * `TextAccessor` — the same subject type, so the result is chainable and
     * snapshot-able. The scalpel for probing large tool outputs; snapshot the
     * whole surface by default, reach for `.grep()` for targeted checks.
     */
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
