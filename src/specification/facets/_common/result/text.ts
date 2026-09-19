import { CaptureScope } from '../../../matching/match.js';
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
 * Backed by a primitive string, exposed via {@link text}, but also provides
 * `toString()` / `valueOf()` for string coercion, so common patterns like
 * `String(result.stdout)` and template-literal interpolation still work.
 *
 * ANSI escape sequences are stripped by default before every comparison
 * (CONVENTIONS D6) — `.text` stays raw. The runner `transform` option remains
 * an escape hatch for application noise not covered by the `{{token}}`
 * grammar.
 *
 * Text operations are **closed** over the type: `.grep(pattern)` returns a
 * `TextAccessor` (not a bare string), preserving the `_expected/`-resolution
 * context and the `transform`, so results are chainable
 * (`result.stdout.grep(a).grep(b)`) and snapshot-able
 * (`expect(result.stdout.grep('users.ts')).toMatch('block.txt')`).
 *
 * Assertions go through `expect()` matchers: `expect(result.stdout).toContain(...)`
 * and `expect(result.stdout).toMatch('name.txt')` (resolved against
 * `_expected/<name>`, flat — with `{{token}}` support, CONVENTIONS D4).
 */
export class TextAccessor {
    /** @internal Ref-capture scope shared by the current spec execution. */
    readonly captures: CaptureScope;
    /** @internal Stream label used in failure messages ("stdout" / "stderr"). */
    readonly streamName: string;
    /** @internal Test-file directory — fixture resolution root for matchers. */
    readonly testDir: string;
    /** The raw captured text (never transformed, ANSI preserved). */
    readonly text: string;
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
        this.text = value;
        this.streamName = streamName;
        this.testDir = testDir;
        this.transform = options.transform;
        this.captures = options.captures ?? new CaptureScope();
    }

    /** @internal The text as compared by matchers — ANSI stripped, transform applied. */
    get comparableText(): string {
        const stripped = stripAnsiCodes(this.text);
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
        return new TextAccessor(grepBlocks(this.text, pattern), this.streamName, this.testDir, {
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
