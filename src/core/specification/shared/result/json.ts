import { CaptureScope } from '../../../matching/match.js';
import { stripAnsiCodes } from './text.js';

/**
 * Read-only accessor for a JSON payload parsed from a text stream (stdout).
 *
 * Lazily parses the JSON on first use; parse errors are deferred until the
 * value is read so that callers can still read the raw stream text without
 * triggering a throw.
 *
 * ANSI escape sequences are stripped by default before `JSON.parse`
 * (CONVENTIONS D6). When a `transform` is configured on the spec runner, it
 * runs on the stripped text — an escape hatch for application noise not
 * covered by the `{{token}}` grammar.
 *
 * Assertions go through `expect()`: `expect(result.json).toMatch('name.json')`
 * (deep-equal against `expected/<name>`, with `{{placeholder}}` support).
 */
export class JsonAccessor {
    /** @internal Ref-capture scope shared by the current spec execution. */
    readonly captures: CaptureScope;
    /** @internal */
    private readonly rawText: string;
    /** @internal Test-file directory — fixture resolution root for matchers. */
    readonly testDir: string;
    /** @internal */
    private readonly transform?: (text: string) => string;

    constructor(
        rawText: string,
        testDir: string,
        transform?: (text: string) => string,
        captures?: CaptureScope,
    ) {
        this.rawText = rawText;
        this.testDir = testDir;
        this.transform = transform;
        this.captures = captures ?? new CaptureScope();
    }

    /** The parsed JSON value. Throws if the text is not valid JSON. */
    get value(): unknown {
        const stripped = stripAnsiCodes(this.rawText);
        const source = this.transform ? this.transform(stripped) : stripped;
        try {
            return JSON.parse(source);
        } catch {
            const preview = source.slice(0, 200);
            throw new Error(`stdout is not valid JSON: ${preview}`);
        }
    }
}
